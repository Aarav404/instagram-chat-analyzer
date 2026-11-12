import type { Conversation } from './types'

export function isGenericWhatsAppTitle(title: string): boolean {
  return /^(?:_?chat(?:\s*\(\d+\))?|whatsapp(?:\s+(?:chat|conversation))?)$/i.test(title.trim())
}

/** Resolve unnamed exports from participants; keep explicit contact/group titles. */
export function withConversationTitle(conversation: Conversation, ownerNames: string[]): Conversation {
  if (conversation.platform !== 'whatsapp' || conversation.titleSource === 'export' || (conversation.titleSource !== 'participants' && !isGenericWhatsAppTitle(conversation.title))) return conversation
  const others = conversation.participants.filter((name) => !ownerNames.includes(name))
  const names = others.length ? others : conversation.participants
  return { ...conversation, titleSource: 'participants', title: names.join(', ') || conversation.title }
}
