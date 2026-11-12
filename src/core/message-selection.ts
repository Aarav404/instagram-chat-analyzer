import emojiRegex from 'emoji-regex'
import { findCompliments } from './compliments'
import { dayKey } from './normalize'
import { senderIdentity } from './sender-identity'
import type { AnalysisRequest, Message, MessageSelection, TextRange } from './types'

const emojiPattern = emojiRegex()

export function wordTokens(text: string): (TextRange & { word: string })[] {
  const tokens: (TextRange & { word: string })[] = []
  for (const match of text.matchAll(/\S+/gu)) {
    const leading = match[0].match(/^[^\p{L}\p{N}]+/u)?.[0].length || 0
    const clean = match[0].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    const word = match[0].toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    if (word) tokens.push({ word, start: match.index + leading, end: match.index + leading + clean.length })
  }
  return tokens
}

/** null means no match; an empty array is a match without text highlights. */
export function matchSelection(message: Message, request: AnalysisRequest, selection?: MessageSelection): TextRange[] | null {
  if (!selection) return []
  const sender = selection.sender
  if (sender?.kind === 'identity' && senderIdentity(message.sender, request) !== sender.name) return null
  if (sender?.kind === 'side' && request.settings.ownerNames.includes(message.sender) !== (sender.side === 'you')) return null
  const date = message.timestamp === null ? null : dayKey(message.timestamp)
  switch (selection.kind) {
    case 'day': return date === selection.date ? [] : null
    case 'type': return message.kind === selection.messageKind ? [] : null
    case 'compliment': {
      if (selection.month && date?.slice(0, 7) !== selection.month) return null
      const matches = findCompliments(message.text).filter((match) => !selection.phrase || match.phrase === selection.phrase)
      return matches.length ? matches.map(({ start, end }) => ({ start, end })) : null
    }
    case 'word': {
      const matches = wordTokens(message.text).filter((token) => token.word === selection.word)
      return matches.length ? matches.map(({ start, end }) => ({ start, end })) : null
    }
    case 'emoji': {
      const matches = [...message.text.matchAll(emojiPattern)].filter((match) => match[0] === selection.emoji)
      return matches.length ? matches.map((match) => ({ start: match.index, end: match.index + match[0].length })) : null
    }
  }
}
