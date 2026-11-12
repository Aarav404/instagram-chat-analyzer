import { BlobReader, TextWriter, ZipReader, configure } from '@zip.js/zip.js'
import type { Conversation, ImportOptions, ImportProgress, ImportReport, ParsedPage, StoredPage } from '../core/types'
import { digestText } from '../core/normalize'
import { instagramPath, parseInstagram } from '../core/parsers/instagram'
import { parseWhatsApp } from '../core/parsers/whatsapp'
import { savePages } from './database'

configure({ useWebWorkers: false }) // Already inside our dedicated worker; no external scripts.
export const MAX_ARCHIVE_BYTES = 5 * 1024 ** 3
export const MAX_PAGE_BYTES = 128 * 1024 ** 2
interface InputEntry { path: string; size: number; read: () => Promise<string> }

export async function importFiles(files: File[], options: ImportOptions, onProgress: (progress: ImportProgress) => void, cancelled: () => boolean): Promise<ImportReport> {
  const started = performance.now()
  const report: ImportReport = { imported: 0, skipped: 0, messages: 0, warnings: [], durationMs: 0, cancelled: false }
  const touched = new Set<string>()
  let completed = 0
  const readers: ZipReader<Blob>[] = []
  const entries: InputEntry[] = []
  const warn = (message: string) => { if (report.warnings.length < 100) report.warnings.push(message) }
  try {
    for (const file of files) {
      if (cancelled()) break
      if (file.size > MAX_ARCHIVE_BYTES) { warn(`${file.name}: exceeds the 5 GB limit.`); continue }
      if (/\.zip$/i.test(file.name)) {
        onProgress({ phase: 'Finding conversations in your archive', completed: 0, total: 0, messages: 0 })
        const reader = new ZipReader(new BlobReader(file))
        readers.push(reader)
        try {
          let scanned = 0
          for await (const entry of reader.getEntriesGenerator()) {
            if (cancelled()) break
            if (++scanned > 200_000) throw new Error('This archive contains more than 200,000 entries. Export messages with low media quality.')
            if (entry.directory || entry.filename.includes('__MACOSX')) continue
            if (!/(?:^|\/)inbox\/[^/]+\/message_\d+\.json$/i.test(entry.filename) && !/\.txt$/i.test(entry.filename)) continue
            if (entry.encrypted) { warn('An encrypted entry was skipped. Extract it before importing.'); continue }
            entries.push({ path: entry.filename, size: entry.uncompressedSize, read: () => entry.getData!(new TextWriter(), { checkSignature: true }) })
          }
        } catch (error) { warn(`${file.name}: ${error instanceof Error ? error.message : 'Could not read ZIP.'}`) }
      } else if (/\.(json|txt)$/i.test(file.name)) entries.push({ path: file.webkitRelativePath || file.name, size: file.size, read: () => file.text() })
    }
    if (!entries.length && !cancelled()) warn('No message files found. Choose an Instagram JSON export ZIP, inbox folder, message JSON files, or WhatsApp text export.')
    // Process a single thread at a time. The ZIP itself and its media never enter memory.
    const buckets = new Map<string, InputEntry[]>()
    for (const entry of entries) {
      const location = instagramPath(entry.path)
      const key = location?.folder ? `ig:${location.folder}` : entry.path
      const bucket = buckets.get(key) || []; bucket.push(entry); buckets.set(key, bucket)
    }
    for (const bucket of buckets.values()) {
      if (cancelled()) break
      const parsedConversations = new Map<string, { metadata: Pick<Conversation, 'id' | 'title' | 'titleSource' | 'platform' | 'participants'>; pages: StoredPage[] }>()
      for (const entry of bucket.sort((a, b) => a.path.localeCompare(b.path))) {
        if (cancelled()) break
        onProgress({ phase: 'Reading messages', completed, total: entries.length, messages: report.messages })
        if (entry.size > MAX_PAGE_BYTES) { warn('A message file exceeds 128 MB when expanded. Split this text/JSON export before importing.'); completed++; continue }
        try {
          const text = await entry.read()
          if (cancelled()) break
          const isWhatsApp = /\.txt$/i.test(entry.path)
          const parsed: ParsedPage = isWhatsApp ? parseWhatsApp(text, entry.path, options) : parseInstagram(text, entry.path)
          if (!parsed.messages.length) { report.skipped++; completed++; continue }
          parsed.warnings.forEach(warn)
          const source = isWhatsApp ? 'whatsapp-export' : entry.path.split('/').at(-1)!
          const contentDigest = await digestText(text)
          const item = parsedConversations.get(parsed.conversationId) || { metadata: { id: parsed.conversationId, title: parsed.title, titleSource: parsed.titleSource, platform: parsed.platform, participants: parsed.participants }, pages: [] }
          item.metadata.participants = [...new Set([...item.metadata.participants, ...parsed.participants])]
          item.pages.push({ id: `${parsed.conversationId}/${source}`, conversationId: parsed.conversationId, source, digest: contentDigest, messages: parsed.messages })
          parsedConversations.set(parsed.conversationId, item)
        } catch (error) { warn(`${entry.path.split('/').at(-1)}: ${error instanceof Error ? error.message : 'Unable to parse file.'}`) }
        completed++
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      if (cancelled()) break // Commit entire conversations only.
      for (const { metadata, pages } of parsedConversations.values()) {
        try {
          const result = await savePages(metadata, pages)
          report.skipped += result.skipped
          if (result.count && !touched.has(metadata.id)) { touched.add(metadata.id); report.messages += result.count }
        } catch (error) {
          if (error instanceof Error && error.name === 'QuotaExceededError') throw new Error('Not enough storage to save this import. Free up space and try again.')
          throw error
        }
      }
      onProgress({ phase: 'Saving conversations', completed, total: entries.length, messages: report.messages })
    }
    report.cancelled = cancelled()
    report.imported = touched.size
    return report
  } finally {
    for (const reader of readers) await reader.close().catch(() => undefined)
    report.durationMs = performance.now() - started
  }
}
