/** Only repair Latin-1 escaped UTF-8 when it decodes losslessly. */
export function repairUnicode(value: string): string {
  if (!/[\u00c2-\u00f4]/.test(value) || [...value].some((char) => char.codePointAt(0)! > 255)) return value
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(value, (char) => char.charCodeAt(0)))
  } catch { return value }
}
export function isIgnoredSender(value: string): boolean {
  return value.normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '').toLowerCase().includes('meta ai')
}
export function normalizeName(value: unknown): string {
  return typeof value === 'string' && value.trim() ? repairUnicode(value).trim() : 'Unknown'
}
export function validTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8.64e15 && !Number.isNaN(new Date(value).getTime()) ? value : null
}
export function dayKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function dayNumber(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  return date.getTime() / 86_400_000
}
export function numberToDay(day: number): string { return new Date(day * 86_400_000).toISOString().slice(0, 10) }
export function stableId(value: string): string {
  // Two independent 32-bit hashes, stable across imports. Not a security hash.
  let a = 2166136261, b = 5381
  for (let i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ value.charCodeAt(i) }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36)
}
export async function digestText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('')
}
