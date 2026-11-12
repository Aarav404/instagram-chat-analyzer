import type { AnalysisRequest, WorkerRequest, WorkerResponse, MatchedMessage } from '../core/types'
import { matchSelection } from '../core/message-selection'
import { Analyzer, matchesFilters } from '../core/analysis'
import { db, getLibrary, getMessages, cacheAnalysis, saveSettings, saveGroup, removeGroup, deleteConversation, clearData } from '../data/database'
import { importFiles } from '../data/importer'
import { loadDemo } from '../data/demo'

let cancelImport = false
let queue: Promise<unknown> = Promise.resolve()
const reply = (message: WorkerResponse) => self.postMessage(message)

async function runAnalysis(request: AnalysisRequest) {
  const library = await getLibrary()
  const selected = library.conversations.filter((c) => request.conversationIds.includes(c.id))
  const key = JSON.stringify({ version: 7, request, revisions: selected.map((c) => [c.id, c.revision]) })
  const database = await db()
  const saved = await database.get('analyses', key)
  if (saved) return saved.result
  const analyzer = new Analyzer(request)
  for (const conversation of selected) {
    if (request.filters.platform !== 'all' && conversation.platform !== request.filters.platform) continue
    analyzer.add(conversation, await getMessages(conversation.id))
  }
  const result = analyzer.finish()
  await cacheAnalysis(key, result)
  return result
}

async function handle(message: WorkerRequest) {
  switch (message.method) {
    case 'library': return getLibrary()
    case 'import':
      cancelImport = false
      return importFiles(message.input.files, message.input.options, (progress) => reply({ id: message.id, progress }), () => cancelImport)
    case 'analyze': return runAnalysis(message.input)
    case 'messages': {
      const { request, offset, limit, selection, search } = message.input
      const library = await getLibrary()
      // Keep only the newest offset + limit candidates while scanning each thread.
      const end = Math.max(0, offset) + Math.min(200, Math.max(1, limit))
      let candidates: MatchedMessage[] = []
      let total = 0
      for (const conversation of library.conversations) {
        if (!request.conversationIds.includes(conversation.id) || (request.filters.platform !== 'all' && conversation.platform !== request.filters.platform)) continue
        for (const item of await getMessages(conversation.id)) {
          if (!matchesFilters(item, request) || (search && !item.text.toLocaleLowerCase().includes(search.toLocaleLowerCase()))) continue
          const highlights = matchSelection(item, request, selection)
          if (highlights === null) continue
          total++
          candidates.push(highlights.length ? { ...item, highlights } : item)
          if (candidates.length >= end + 500) {
            candidates.sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity) || a.id.localeCompare(b.id))
            candidates.length = end
          }
        }
        candidates.sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity) || a.id.localeCompare(b.id))
        if (candidates.length > end) candidates.length = end
      }
      return { messages: candidates.slice(offset, end), total, offset }
    }
    case 'saveSettings': return saveSettings(message.input)
    case 'saveGroup': return saveGroup(message.input)
    case 'removeGroup': return removeGroup(message.input)
    case 'deleteConversation': return deleteConversation(message.input)
    case 'clear': return clearData()
    case 'demo': return loadDemo()
  }
}
self.onmessage = (event: MessageEvent<WorkerRequest | { method: 'cancel' }>) => {
  const message = event.data
  if (message.method === 'cancel') { cancelImport = true; return }
  queue = queue.then(async () => {
    try { reply({ id: message.id, result: await handle(message) }) }
    catch (error) { reply({ id: message.id, error: error instanceof Error ? error.message : 'Something went wrong while processing your data.' }) }
  })
}
