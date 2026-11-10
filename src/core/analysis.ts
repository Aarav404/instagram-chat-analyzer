import emojiRegex from 'emoji-regex'
import { dayKey, dayNumber, isIgnoredSender, numberToDay } from './normalize'
import type { Analysis, AnalysisRequest, Conversation, CountItem, Message, SenderStats } from './types'

const SESSION_GAP = 6 * 60 * 60
const MAX_REPLY_GAP = 7 * 24 * 60 * 60
const increment = (map: Map<string, number>, key: string, n = 1) => map.set(key, (map.get(key) || 0) + n)
const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
function median(values: number[]): number | null {
  if (!values.length) return null
  values.sort((a, b) => a - b)
  const half = Math.floor(values.length / 2)
  return values.length % 2 ? values[half] : (values[half - 1] + values[half]) / 2
}
const top = (map: Map<string, number>, limit = 40): CountItem[] => [...map].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit)
const clamp = (n: number) => Math.max(0, Math.min(100, n))

export function matchesFilters(message: Message, request: AnalysisRequest): boolean {
  if (isIgnoredSender(message.sender)) return false
  const { from, to, sender, query } = request.filters
  if (sender && message.sender !== sender) return false
  if (query && !message.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return false
  if (from || to) {
    if (message.timestamp === null) return false
    const key = dayKey(message.timestamp)
    if ((from && key < from) || (to && key > to)) return false
  }
  return true
}

/** Incremental accumulator: only one source conversation needs to be in memory. */
export class Analyzer {
  private started = performance.now()
  private total = 0
  private datedTotal = 0
  private days = new Map<string, { count: number; sent: number }>()
  private heat = new Uint32Array(168)
  private senders = new Map<string, number>()
  private words = new Map<string, number>()
  private emojis = new Map<string, number>()
  private kinds = new Map<string, number>()
  private threads = new Map<string, number>()
  private wordCount = 0
  private replies = new Map<string, number[]>()
  private withinReplies = new Map<string, number[]>()
  private betweenReplies = new Map<string, number[]>()
  private doubles = new Map<string, number>()
  private starts = new Map<string, number>()
  private legacyMessages: Message[] = []
  private own: Set<string>
  private participantCount = 0
  private emojiPattern = emojiRegex()
  constructor(private request: AnalysisRequest) { this.own = new Set(request.settings.ownerNames) }

  add(conversation: Conversation, messages: Message[]): void {
    if (this.request.filters.platform !== 'all' && conversation.platform !== this.request.filters.platform) return
    const filtered = messages.filter((m) => matchesFilters(m, this.request))
    this.participantCount = Math.max(this.participantCount, conversation.participants.length)
    increment(this.threads, conversation.id, filtered.length)
    const dated: Message[] = []
    for (const message of filtered) {
      this.total++
      increment(this.senders, message.sender)
      increment(this.kinds, message.kind)
      const tokens = message.text.trim().split(/\s+/).filter(Boolean)
      this.wordCount += tokens.length
      for (const word of tokens) {
        const clean = word.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
        if (clean.length > 1 && clean.length < 45 && !clean.startsWith('http') && !/\d/.test(clean)) {
          // Bounded vocabulary prevents pathological inputs from consuming unbounded memory.
          if (this.words.size < 100_000 || this.words.has(clean)) increment(this.words, clean)
        }
      }
      for (const match of message.text.matchAll(this.emojiPattern)) increment(this.emojis, match[0])
      if (message.timestamp === null) continue
      this.datedTotal++
      dated.push(message)
      const day = dayKey(message.timestamp)
      const current = this.days.get(day) || { count: 0, sent: 0 }
      current.count++
      if (this.own.has(message.sender)) current.sent++
      this.days.set(day, current)
      const date = new Date(message.timestamp)
      this.heat[((date.getDay() + 6) % 7) * 24 + date.getHours()]++
    }
    dated.sort((a, b) => a.timestamp! - b.timestamp!)
    if (this.request.settings.calculationMode === 'legacy') {
      for (const m of dated) this.legacyMessages.push(m)
    } else this.analyzeSequence(dated)
  }

  private sample(map: Map<string, number[]>, sender: string, value: number) {
    const list = map.get(sender) || []
    list.push(value)
    map.set(sender, list)
  }

  private analyzeSequence(ordered: Message[]) {
    let previous: Message | null = null
    let pendingSender = '', pendingCount = 0
    const flush = () => { if (pendingCount > 1) increment(this.doubles, pendingSender, pendingCount - 1) }
    for (const message of ordered) {
      const gap = previous ? (message.timestamp! - previous.timestamp!) / 1000 : 0
      const switched = previous && previous.sender !== message.sender
      if (switched && gap >= 0 && gap <= MAX_REPLY_GAP) this.sample(this.replies, message.sender, gap)
      if (!previous || gap > SESSION_GAP) {
        if (this.request.settings.calculationMode !== 'legacy') flush()
        increment(this.starts, message.sender)
        if (previous) this.sample(this.betweenReplies, message.sender, gap)
        pendingSender = message.sender
        pendingCount = 1
      } else if (message.sender === pendingSender) pendingCount++
      else {
        flush()
        if (gap >= 0 && gap <= MAX_REPLY_GAP) this.sample(this.withinReplies, message.sender, gap)
        pendingSender = message.sender
        pendingCount = 1
      }
      previous = message
    }
    flush()
  }

  finish(): Analysis {
    if (this.request.settings.calculationMode === 'legacy') {
      this.legacyMessages.sort((a, b) => a.timestamp! - b.timestamp!)
      this.analyzeSequence(this.legacyMessages)
      this.legacyMessages = []
    }
    const activeDates = [...this.days.keys()].sort()
    const firstDate = activeDates[0] || null, lastDate = activeDates.at(-1) || null
    let longest = 0, current = 0, start: string | null = null, bestStart: string | null = null, bestEnd: string | null = null
    let previousDay = -Infinity
    let busiestDay: Analysis['busiestDay'] = null
    for (const day of activeDates) {
      const num = dayNumber(day)
      if (num === previousDay + 1) current++
      else { current = 1; start = day }
      if (current > longest) { longest = current; bestStart = start; bestEnd = day }
      previousDay = num
      const count = this.days.get(day)!.count
      if (!busiestDay || count > busiestDay.count) busiestDay = { date: day, count }
    }
    let calendarDays = activeDates
    if (firstDate && lastDate && this.request.settings.calculationMode !== 'legacy') {
      const first = dayNumber(firstDate), last = dayNumber(lastDate)
      // Exports with corrupt multi-century timestamps must not allocate billions of days.
      if (last - first <= 73_200) calendarDays = Array.from({ length: last - first + 1 }, (_, i) => numberToDay(first + i))
    }
    const window: number[] = []
    let sum = 0
    const daily = calendarDays.map((date) => {
      const { count, sent } = this.days.get(date) || { count: 0, sent: 0 }
      window.push(count); sum += count
      if (window.length > 7) sum -= window.shift()!
      return { date, count, sent, received: count - sent, average: sum / window.length }
    })
    const isSides = this.request.settings.shareMode === 'sides' || (this.request.settings.shareMode === 'auto' && (!!this.request.groupName || this.participantCount <= 2))
    let counts = [...this.senders].map(([name, count]) => ({ name, count }))
    if (isSides && this.own.size) {
      const ownCount = [...this.senders].reduce((n, [name, count]) => n + (this.own.has(name) ? count : 0), 0)
      const otherNames = [...this.senders.keys()].filter((s) => !this.own.has(s))
      counts = [{ name: 'You', count: ownCount }, { name: this.request.groupName || (otherNames.length === 1 ? otherNames[0] : 'Others'), count: this.total - ownCount }].filter((item) => item.count > 0)
    }
    const shares = counts.map((item) => ({ ...item, share: this.total ? item.count / this.total * 100 : 0 }))
    const shareCounts = shares.map((s) => s.count)
    const engagement = !shareCounts.length ? null : shareCounts.length > 1 ? Math.min(...shareCounts) / Math.max(...shareCounts) * 100 : 100
    const senderStats: SenderStats[] = [...this.senders].map(([name, count]) => ({
      name, count, share: this.total ? count / this.total * 100 : 0,
      medianReplySeconds: median(this.replies.get(name) || []),
      averageReplySeconds: average(this.replies.get(name) || []),
      withinSessionMedianSeconds: median(this.withinReplies.get(name) || []),
      betweenSessionAverageSeconds: average(this.betweenReplies.get(name) || []),
      doubleTexts: this.doubles.get(name) || 0, initiations: this.starts.get(name) || 0,
    })).sort((a, b) => b.count - a.count)
    let replySum = 0, replyCount = 0, sessionSum = 0, sessionCount = 0
    for (const values of this.replies.values()) for (const value of values) { replySum += value; replyCount++ }
    for (const values of this.withinReplies.values()) for (const value of values) { sessionSum += value; sessionCount++ }
    const avgSession = sessionCount ? sessionSum / sessionCount : null
    const doubles = [...this.doubles.values()].reduce((a, b) => a + b, 0)
    const initiations = [...this.starts.values()].reduce((a, b) => a + b, 0)
    return {
      total: this.total, datedTotal: this.datedTotal, firstDate, lastDate, activeDays: activeDates.length,
      busiestDay, streak: { days: longest, start: bestStart, end: bestEnd },
      averageReplySeconds: replyCount ? replySum / replyCount : null, daily,
      heatmap: Array.from(this.heat, (value, i) => [i % 24, Math.floor(i / 24), value] as [number, number, number]),
      shares, senders: senderStats, engagement,
      delayScore: avgSession === null ? (this.request.settings.calculationMode === 'legacy' ? 100 : null) : clamp(100 - avgSession / 60),
      averageSessionReplySeconds: avgSession, doubleTexts: doubles,
      doubleTextScore: clamp(doubles / Math.max(this.datedTotal, 1) * 100),
      initiations, initiationScore: clamp(initiations / Math.max(this.datedTotal, 1) * 100),
      words: this.wordCount, topWords: top(this.words), emojis: top(this.emojis), kinds: top(this.kinds), threads: top(this.threads, 1000),
      processingMs: performance.now() - this.started,
    }
  }
}

export function analyze(conversations: { conversation: Conversation; messages: Message[] }[], request: AnalysisRequest): Analysis {
  const analyzer = new Analyzer(request)
  for (const { conversation, messages } of conversations) analyzer.add(conversation, messages)
  return analyzer.finish()
}
