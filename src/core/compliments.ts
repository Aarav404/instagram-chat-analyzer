import type { ComplimentCategory } from './types'

const COMPLIMENTS: { category: ComplimentCategory; patterns: RegExp[] }[] = [
  { category: 'Personality', patterns: [
    /\b(?:kind|thoughtful|caring|genuine|loyal|patient|sweet|nice|lovely|wonderful|amazing person|good hearted)\b/giu,
    /\b(?:you|u|tu|tum|aap)\s+(?:are|r|seem|lagte? ho|ho|hai|hain)\s+(?:so\s+)?(?:kind|sweet|nice|thoughtful|caring|lovely|amazing)\b/giu,
    /\b(?:(?:tum|tu|aap)\s+)?(?:(?:bahut|bohot|bohut|bhot|kaafi)\s+)?samajhdaar(?:\s+(?:ho|hai|hain))?\b/giu,
  ] },
  { category: 'Appearance', patterns: [
    /\b(?:beautiful|pretty|cute|gorgeous|handsome|stunning|attractive|good looking|adorable|sundar|khoobsurat|pyaar[ai]|pyar[ai]|khubsurat)\b/giu,
    /\b(?:look|looks|looking)\s+(?:so\s+)?(?:good|beautiful|pretty|cute|gorgeous|hot|sexy|fine)\b/giu,
    /\b(?:you(?:'re| are)|u r|he's|she's|they're)\s+(?:so\s+|really\s+|very\s+)?(?:sexy|hot)\b/giu,
    /\b(?:you(?:'re| are)|u r|he's|she's|they're)\s+(?:(?:so|really|very)\s+)fine\b/giu,
    /\b(?:you(?:'re| are)|u r|he's|she's|they're)\s+(?:such a\s+|a\s+)?baddie\b/giu,
    /\b(?:what a|such a)\s+baddie\b/giu,
    /\b(?:you(?:'re| are)|u r|he's|she's|they're)\s+(?:such a\s+)?snack\b/giu,
    /\b(?:look|looking)\s+like\s+a\s+snack\b/giu,
    /\b(?:(?:tum|tu|aap|teri|tumhari|tera|tumhara)\s+)?(?:(?:bahut|bohot|bohut|bhot|itni|itna|kitni|kitna)\s+)?(?:pyaari|pyari|pyaara|pyara|pyaare|sundar|khoobsurat|khubsurat)(?:\s+(?:lagti|lagte|lagta|lag|ho|hai|hain))?\b/giu,
    // Style slang is matched only in explicit praise constructions to avoid
    // counting literal fire, eating, or unrelated uses as compliments.
    /\b(?:your|that|this|the)\s+(?:fit|outfit|look|style|hair|makeup|pic|picture|photo)\s+(?:is|looks|was)\s+(?:so\s+)?(?:fire|iconic|goated|on point)\b/giu,
    /\b(?:you(?:'re| are)|u r)\s+serving\s+(?:looks|face|a\s+look)\b/giu,
    /\b(?:you(?:'ve| have)\s+got|you got)\s+drip\b/giu,
  ] },
  { category: 'Ability', patterns: [
    /\b(?:smart|intelligent|clever|brilliant|talented|skillful|skilled|creative|capable|hardworking|genius|tez dimaag)\b/giu,
    /\b(?:you|u)\s+(?:are|r)\s+(?:so\s+)?(?:smart|talented|brilliant|clever|intelligent)\b/giu,
    /\b(?:(?:tum|tu|aap)\s+)?(?:(?:bahut|bohot|bohut|bhot|kaafi|itne|itni|kitne|kitni)\s+)?(?:smart|intelligent|clever|brilliant|talented|creative|samajhdaar|genius)(?:\s+(?:ho|hai|hain))?\b/giu,
    /\b(?:you(?:'re| are)|u r|that was|this is|that is|this was)\s+(?:so\s+|actually\s+|literally\s+)?(?:iconic|goated)\b/giu,
    /\b(?:you|u)\s+(?:absolutely\s+|literally\s+|really\s+)?(?:slayed|slay)\s+(?:that|it|this)\s+(?:fit|outfit|look|performance|dance|song|joke|presentation|edit)\b/giu,
    /\b(?:you|u)\s+(?:absolutely\s+|literally\s+|really\s+)?ate\s+(?:that|it|this)\s+(?:fit|outfit|look|performance|dance|song|joke|presentation|edit)(?:\s+up)?\b/giu,
    /\b(?:you|u)\s+(?:absolutely\s+|literally\s+)?ate\s+and\s+left\s+no\s+crumbs\b/giu,
  ] },
  { category: 'Affection / humor', patterns: [/\b(?:funny|hilarious|hysterical|adorable|cutie|queen|love you|love u|jaan|babe|mazaakia|mast)\b/giu, /\b(?:(?:tum|tu|aap)\s+)?(?:(?:bahut|bohot|bohut|bhot|itne|itni|kaafi)\s+)?(?:funny|hilarious|cute|adorable|mazaakia|mast)(?:\s+(?:ho|hai|hain))?\b/giu] },
]
export function findCompliments(text: string): { category: ComplimentCategory; phrase: string; start: number; end: number }[] {
  const matches: { category: ComplimentCategory; start: number; end: number; phrase: string }[] = []
  for (const { category, patterns } of COMPLIMENTS) for (const pattern of patterns) {
    pattern.lastIndex = 0
    // Reuse the compiled global expression instead of cloning it for every message.
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) if (match[0].trim()) matches.push({ category, start: match.index, end: match.index + match[0].length, phrase: match[0].toLocaleLowerCase() })
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end)
  const selected: typeof matches = []
  for (const match of matches) if (!selected.some((existing) => existing.category === match.category && match.start < existing.end && match.end > existing.start)) selected.push(match)
  return selected
}
