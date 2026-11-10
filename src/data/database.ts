import { openDB, type DBSchema } from 'idb'
import type { Analysis, ChatGroup, Conversation, Library, Settings, StoredPage } from '../core/types'

interface AaloeLyzerDB extends DBSchema {
  conversations: { key: string; value: Conversation }
  pages: { key: string; value: StoredPage; indexes: { conversation: string } }
  preferences: { key: string; value: Settings | ChatGroup[] }
  analyses: { key: string; value: { key: string; result: Analysis; accessed: number } }
}
export const DEFAULT_SETTINGS: Settings = { ownerNames: [], identityConfirmed: false, calculationMode: 'standard', shareMode: 'auto' }
export const db = () => openDB<AaloeLyzerDB>('aaloe-private-chats', 1, {
  upgrade(database) {
    database.createObjectStore('conversations', { keyPath: 'id' })
    const pages = database.createObjectStore('pages', { keyPath: 'id' })
    pages.createIndex('conversation', 'conversationId')
    database.createObjectStore('preferences')
    database.createObjectStore('analyses', { keyPath: 'key' })
  },
})

export async function getLibrary(): Promise<Library> {
  const database = await db()
  const [conversations, savedSettings, savedGroups] = await Promise.all([
    database.getAll('conversations'), database.get('preferences', 'settings'), database.get('preferences', 'groups'),
  ])
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(!Array.isArray(savedSettings) ? savedSettings : {}) }
  const groups = Array.isArray(savedGroups) ? savedGroups : []
  if (!settings.identityConfirmed) {
    const frequency = new Map<string, number>()
    for (const c of conversations) for (const p of c.participants) frequency.set(p, (frequency.get(p) || 0) + 1)
    settings.ownerNames = [...frequency].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 1).map(([name]) => name)
  }
  return { conversations: conversations.sort((a, b) => b.messageCount - a.messageCount), groups, settings }
}

export async function getMessages(id: string) {
  const database = await db()
  const pages = await database.getAllFromIndex('pages', 'conversation', id)
  // Match the export's stable page order for timestamp ties.
  pages.sort((a, b) => a.source.localeCompare(b.source))
  return pages.flatMap((page) => page.messages)
}

export async function savePages(conversation: Pick<Conversation, 'id' | 'title' | 'platform' | 'participants' | 'isDemo'>, pages: StoredPage[]): Promise<{ skipped: number; count: number }> {
  const database = await db()
  const existing = await database.getAllFromIndex('pages', 'conversation', conversation.id)
  const merged = new Map(existing.map((page) => [page.id, page]))
  const changed = pages.filter((page) => merged.get(page.id)?.digest !== page.digest)
  if (!changed.length) return { skipped: pages.length, count: 0 }
  for (const page of changed) merged.set(page.id, page)
  const previous = await database.get('conversations', conversation.id)
  let count = 0, first: number | null = null, last: number | null = null
  const people = new Set(conversation.participants)
  for (const page of merged.values()) for (const m of page.messages) {
    count++; people.add(m.sender)
    if (m.timestamp !== null) { first = first === null ? m.timestamp : Math.min(first, m.timestamp); last = last === null ? m.timestamp : Math.max(last, m.timestamp) }
  }
  const transaction = database.transaction(['pages', 'conversations', 'analyses'], 'readwrite')
  for (const page of changed) void transaction.objectStore('pages').put(page)
  void transaction.objectStore('conversations').put({ ...conversation, participants: [...people].sort(), messageCount: count, firstTimestamp: first, lastTimestamp: last, importedAt: Date.now(), revision: (previous?.revision || 0) + 1 })
  void transaction.objectStore('analyses').clear()
  await transaction.done
  return { skipped: pages.length - changed.length, count }
}

export async function saveSettings(settings: Settings) { const database = await db(); await database.put('preferences', settings, 'settings'); return settings }
export async function saveGroup(group: ChatGroup): Promise<ChatGroup[]> {
  if (!group.name.trim() || !group.conversationIds.length) throw new Error('Give your group a name and select at least one conversation.')
  const library = await getLibrary()
  if (library.groups.some((g) => g.id !== group.id && g.name.toLocaleLowerCase() === group.name.trim().toLocaleLowerCase())) throw new Error('A group already has that name.')
  const validIds = new Set(library.conversations.map((c) => c.id))
  const cleaned = { ...group, name: group.name.trim().slice(0, 100), conversationIds: [...new Set(group.conversationIds)].filter((id) => validIds.has(id)) }
  if (!cleaned.conversationIds.length) throw new Error('The selected conversations are no longer available.')
  const groups = [...library.groups.filter((g) => g.id !== group.id), cleaned]
  const database = await db(); await database.put('preferences', groups, 'groups'); return groups
}
export async function removeGroup(id: string) { const library = await getLibrary(); const groups = library.groups.filter((g) => g.id !== id); const database = await db(); await database.put('preferences', groups, 'groups'); return groups }
export async function deleteConversation(id: string) {
  const database = await db()
  const pageKeys = await database.getAllKeysFromIndex('pages', 'conversation', id)
  const library = await getLibrary()
  const groups = library.groups.map((g) => ({ ...g, conversationIds: g.conversationIds.filter((cid) => cid !== id) })).filter((g) => g.conversationIds.length)
  const transaction = database.transaction(['pages', 'conversations', 'analyses', 'preferences'], 'readwrite')
  for (const key of pageKeys) void transaction.objectStore('pages').delete(key)
  void transaction.objectStore('conversations').delete(id)
  void transaction.objectStore('analyses').clear()
  void transaction.objectStore('preferences').put(groups, 'groups')
  await transaction.done
  return getLibrary()
}
export async function clearData() {
  const database = await db()
  const tx = database.transaction(['pages', 'conversations', 'preferences', 'analyses'], 'readwrite')
  for (const name of tx.objectStoreNames) void tx.objectStore(name).clear()
  await tx.done
}
export async function cacheAnalysis(key: string, result: Analysis) {
  const database = await db()
  const keys = await database.getAll('analyses')
  const transaction = database.transaction('analyses', 'readwrite')
  for (const entry of keys.sort((a, b) => b.accessed - a.accessed).slice(19)) void transaction.store.delete(entry.key)
  void transaction.store.put({ key, result, accessed: Date.now() })
  await transaction.done
}
