const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const notifications = /^(?:(?:liked|reacted(?:\s+.+?)?\s+to|unsent|deleted)\s+(?:(?:a|your|the|this)\s+)?message|sent\s+(?:(?:an?|the)\s+)?(?:attachment|photo|video|audio|voice message|sticker|gif|reel|post)|(?:started|ended|missed)\s+(?:(?:an?|the)\s+)?(?:audio |video )?call)[.!]?$/iu

/** Remove export-generated notices and URLs only from word/emoji frequency inputs. */
export function createFrequencyText(participants: string[]): (text: string) => string {
  const names = [...new Set(['You', ...participants])].filter(Boolean).sort((a, b) => b.length - a.length)
  const senderPrefix = new RegExp(`^(?:${names.map(escapePattern).join('|')})\\s+`, 'iu')
  return (text) => text.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim()
    if (/^(?:<media omitted>|(?:image|video|audio|sticker|gif|document) omitted|this message was (?:deleted|unsent))\.?$/iu.test(trimmed)) return false
    return !notifications.test(trimmed.replace(senderPrefix, ''))
  }).join('\n').replace(/(?:https?:\/\/|www\.)\S+/giu, '')
}
