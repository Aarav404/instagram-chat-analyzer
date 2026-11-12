import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'
import { withConversationTitle } from '../src/core/conversation-title'
import { digestText, stableId } from '../src/core/normalize'
import { parseWhatsApp } from '../src/core/parsers/whatsapp'
import { clearData, DEFAULT_SETTINGS, getLibrary, getMessages, saveGroup, savePages, saveSettings } from '../src/data/database'
import { importFiles } from '../src/data/importer'
import { conversation } from './fixtures'

// Synthetic iOS export: directional marks, narrow spaces, seconds, and CRLF.
const exportText = '[29/04/26, 7:33:34\u202fAM] Alex: Hello\r\n\u200e[26/06/26, 10:47:18\u202fAM] Robin: \u200edocument omitted\r\n[26/06/26, 10:52:04\u202fAM] Alex: Thanks'
const options = { dateOrder: 'DMY' as const }
const importFile = (file: File) => importFiles([file], options, () => undefined, () => false)
const chooseOwner = (ownerNames: string[]) => saveSettings({ ...DEFAULT_SETTINGS, ownerNames, identityConfirmed: true })

beforeEach(() => clearData())

describe('WhatsApp conversation names', () => {
  it('uses participants for unnamed exports and keeps existing conversation IDs', () => {
    const parsed = parseWhatsApp(exportText, '_chat.txt')
    expect(parsed.title).toBe('Alex, Robin')
    expect(parsed.titleSource).toBe('participants')
    expect(parsed.conversationId).toBe(`wa-${stableId('WhatsApp conversation:Alex|Robin')}`)
    expect(parsed.messages).toHaveLength(3)
    expect(parsed.messages[1].kind).toBe('attachment')
    for (const filename of ['chat.txt', '_chat (1).txt', 'WhatsApp conversation.txt', 'archive/_chat.txt']) {
      expect(parseWhatsApp(exportText, filename).title).toBe('Alex, Robin')
    }
  })

  it('updates contact names as owner accounts change without guessing unknown aliases', () => {
    const parsed = parseWhatsApp(exportText, '_chat.txt')
    const metadata = { ...conversation(parsed.conversationId, parsed.messages), ...parsed, platform: 'whatsapp' as const }
    const renamed = withConversationTitle(metadata, ['Alex'])
    expect(renamed.title).toBe('Robin')
    expect(withConversationTitle(renamed, ['Robin']).title).toBe('Alex')
    expect(withConversationTitle(renamed, ['Alex on Instagram']).title).toBe('Alex, Robin')
    expect(withConversationTitle(renamed, []).title).toBe('Alex, Robin')
    expect(withConversationTitle(renamed, ['Alex', 'Robin']).title).toBe('Alex, Robin')
    const group = { ...metadata, participants: ['Alex', 'Alex work', 'Robin', 'Sam'] }
    expect(withConversationTitle(group, ['Alex', 'Alex work']).title).toBe('Robin, Sam')
  })

  it('preserves explicit contact and group names, plus Instagram titles', () => {
    for (const [filename, title] of [['WhatsApp Chat with Robin.txt', 'Robin'], ['Weekend plans.txt', 'Weekend plans'], ['WhatsApp Chat with Chat.txt', 'Chat']]) {
      const parsed = parseWhatsApp(exportText, filename)
      expect(parsed.titleSource).toBe('export')
      expect(withConversationTitle({ ...conversation(parsed.conversationId, parsed.messages), ...parsed }, ['Alex']).title).toBe(title)
    }
    expect(withConversationTitle({ ...conversation('ig', []), title: 'chat', participants: ['Alex', 'Robin'] }, ['Alex']).title).toBe('chat')
  })

  it.each(['txt', 'zip'])('retains naming metadata through %s imports and avoids duplicate reimports', async (format) => {
    await chooseOwner(['Alex'])
    let blob: Blob = new Blob([exportText])
    if (format === 'zip') {
      const zip = new ZipWriter(new BlobWriter())
      await zip.add('_chat.txt', new TextReader(exportText))
      blob = await zip.close()
    }
    const file = new File([blob], format === 'zip' ? 'WhatsApp export.zip' : '_chat.txt')
    const report = await importFile(file)
    expect(report).toMatchObject({ imported: 1, messages: 3, warnings: [] })
    expect((await getLibrary()).conversations[0]).toMatchObject({ title: 'Robin', titleSource: 'participants', messageCount: 3 })
    await chooseOwner(['Robin'])
    expect((await getLibrary()).conversations[0].title).toBe('Alex')
    expect((await importFile(file)).skipped).toBe(1)
    expect((await getLibrary()).conversations).toHaveLength(1)
  })

  it('repairs previous generic labels without reimporting or breaking groups', async () => {
    const parsed = parseWhatsApp(exportText, '_chat.txt')
    const id = parsed.conversationId
    // Metadata and source IDs written by the old importer, before titleSource existed.
    await savePages({ id, title: 'WhatsApp conversation', platform: 'whatsapp', participants: parsed.participants }, [
      { id: `${id}/whatsapp-export`, conversationId: id, source: 'whatsapp-export', digest: await digestText(exportText), messages: parsed.messages },
    ])
    await saveGroup({ id: 'combined', name: 'Combined accounts', conversationIds: [id] })
    await chooseOwner(['Alex'])
    expect((await getLibrary()).conversations[0]).toMatchObject({ id, title: 'Robin' })
    const report = await importFile(new File([exportText], '_chat.txt'))
    expect(report).toMatchObject({ imported: 0, skipped: 1 })
    const library = await getLibrary()
    expect(library.conversations).toHaveLength(1)
    expect(library.conversations[0].title).toBe('Robin')
    expect(library.groups[0].conversationIds).toEqual([id])
    expect(await getMessages(id)).toHaveLength(3)
  })
})
