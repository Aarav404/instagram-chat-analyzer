import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearData, deleteConversation, getLibrary, getMessages, saveGroup, savePages, saveSettings } from '../src/data/database'
import { conversation, message } from './fixtures'

beforeEach(() => clearData())
describe('local persistence', () => {
  it('reimports without inflating counts and replaces updated pages atomically', async () => {
    const messages = [message('Me', 0), message('Peer', 10)]
    const metadata = conversation('chat-a', messages)
    const page = { id: 'chat-a/message_1.json', conversationId: 'chat-a', source: 'message_1.json', digest: 'hash1', messages }
    await savePages(metadata, [page]); expect((await savePages(metadata, [page])).skipped).toBe(1)
    expect((await getLibrary()).conversations[0].messageCount).toBe(2)
    await savePages(metadata, [{ ...page, digest: 'hash2', messages: [...messages, message('Me', 20)] }])
    expect((await getMessages('chat-a'))).toHaveLength(3)
  })
  it('combines pages, preserves groups, and prunes deleted members', async () => {
    const metadata = conversation('chat-a', [])
    await savePages(metadata, [1, 2].map((i) => ({ id: `chat-a/message_${i}.json`, conversationId: 'chat-a', source: `message_${i}.json`, digest: `${i}`, messages: [message('Me', i)] })))
    await saveGroup({ id: 'group-a', name: 'Peer', conversationIds: ['chat-a', 'chat-a'] })
    expect((await getLibrary()).groups[0].conversationIds).toEqual(['chat-a'])
    expect((await getLibrary()).conversations[0].messageCount).toBe(2)
    await deleteConversation('chat-a'); expect((await getLibrary()).groups).toEqual([]); expect(await getMessages('chat-a')).toEqual([])
  })
  it('keeps an explicit owner choice after reload and clears all data', async () => {
    await saveSettings({ ownerNames: ['Not hardcoded'], identityConfirmed: true, calculationMode: 'standard', shareMode: 'auto' })
    expect((await getLibrary()).settings.ownerNames).toEqual(['Not hardcoded'])
    await clearData(); expect((await getLibrary()).settings.ownerNames).toEqual([])
  })
})
