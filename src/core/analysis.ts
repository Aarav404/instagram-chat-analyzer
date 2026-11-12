import { findCompliments } from './compliments'
import { wordTokens } from './message-selection'
import { STOP_WORDS } from './stop-words'
import { createFrequencyText } from './frequency-text'
import emojiRegex from 'emoji-regex'
import { dayKey, dayNumber, isIgnoredSender, numberToDay } from './normalize'
import { combinesGroupAccounts, senderIdentity } from './sender-identity'
import type { Analysis, AnalysisRequest, Conversation, CountItem, Message, SenderStats, ComplimentCategory, ComplimentExample, CallSenderStats, CallDailyPoint } from './types'

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
  if (sender && senderIdentity(message.sender, request) !== sender) return false
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
  private complimentCounts = new Map<string, Map<ComplimentCategory, number>>()
  private complimentPhrases = new Map<string, Map<string, number>>()
  private complimentMonths = new Map<string, number>()
  private complimentExamples: ComplimentExample[] = []
  private complimentTotal = 0
  private callCounts = new Map<string, number>()
  private callDurations = new Map<string, number[]>()
  private callDaily = new Map<string, { calls: number; totalDurationSeconds: number; durationCount: number }>()
  private totalCalls = 0
  private totalCallDurationSeconds = 0
  private totalCallDurationCount = 0
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
  constructor(private request: AnalysisRequest) { this.own = new Set(combinesGroupAccounts(request) ? ['You'] : request.settings.ownerNames) }

  add(conversation: Conversation, messages: Message[]): void {
    if (this.request.filters.platform !== 'all' && conversation.platform !== this.request.filters.platform) return
    const frequencyText = createFrequencyText(conversation.participants)
    const filtered = messages.filter((m) => matchesFilters(m, this.request)).map((message) => {
      const sender = senderIdentity(message.sender, this.request)
      return sender === message.sender ? message : { ...message, sender }
    })
    this.participantCount = Math.max(this.participantCount, conversation.participants.length)
    increment(this.threads, conversation.id, filtered.length)
    const dated: Message[] = []
    for (const message of filtered) {
      this.total++
      increment(this.senders, message.sender)
      if (message.kind === 'call') {
        this.totalCalls++
        increment(this.callCounts, message.sender)
        const dailyKey = message.timestamp === null ? null : `${dayKey(message.timestamp)}\u0000${message.sender}`
        const daily = dailyKey ? this.callDaily.get(dailyKey) || { calls: 0, totalDurationSeconds: 0, durationCount: 0 } : null
        if (daily) { daily.calls++; this.callDaily.set(dailyKey!, daily) }
        const seconds = message.callDurationSeconds
        if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0) {
          const values = this.callDurations.get(message.sender) || []
          values.push(seconds)
          this.callDurations.set(message.sender, values)
          this.totalCallDurationSeconds += seconds
          this.totalCallDurationCount++
          if (daily) { daily.totalDurationSeconds += seconds; daily.durationCount++ }
        }
      }
      for (const { category, phrase } of findCompliments(message.text)) {
        this.complimentTotal++
        const categories = this.complimentCounts.get(message.sender) || new Map<ComplimentCategory, number>()
        categories.set(category, (categories.get(category) || 0) + 1)
        this.complimentCounts.set(message.sender, categories)
        const phrases = this.complimentPhrases.get(message.sender) || new Map<string, number>()
        increment(phrases, phrase)
        this.complimentPhrases.set(message.sender, phrases)
        if (message.timestamp !== null) increment(this.complimentMonths, `${dayKey(message.timestamp).slice(0, 7)}\u0000${message.sender}`)
        if (this.complimentExamples.length < 500) this.complimentExamples.push({ sender: message.sender, text: message.text, timestamp: message.timestamp, category, phrase })
      }
      increment(this.kinds, message.kind)
      const tokens = message.text.trim().split(/\s+/).filter(Boolean)
      this.wordCount += tokens.length
      const frequencyInput = frequencyText(message.text)
      for (const { word: clean } of wordTokens(frequencyInput)) {
        if (clean.length > 1 && clean.length < 45 && !STOP_WORDS.has(clean) && !clean.startsWith('http') && !/\d/.test(clean)) {
          // Bounded vocabulary prevents pathological inputs from consuming unbounded memory.
          if (this.words.size < 100_000 || this.words.has(clean)) increment(this.words, clean)
        }
      }
      for (const match of frequencyInput.matchAll(this.emojiPattern)) increment(this.emojis, match[0])
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
    if (isSides && this.own.size && !combinesGroupAccounts(this.request)) {
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
    const categories = ['Personality', 'Appearance', 'Ability', 'Affection / humor'] as const
    const complimentSenders = [...this.complimentCounts].map(([name, counts]) => {
      const values = Object.fromEntries(categories.map((category) => [category, counts.get(category) || 0])) as Record<ComplimentCategory, number>
      const count = Object.values(values).reduce((sum, value) => sum + value, 0)
      return { name, count, perThousand: (count / Math.max(this.senders.get(name) || 0, 1)) * 1000, topCategory: categories.reduce<ComplimentCategory | null>((best, category) => values[category] > (best ? values[best] : 0) ? category : best, null), categories: values, phrases: top(this.complimentPhrases.get(name) || new Map(), 100) }
    }).sort((a, b) => b.count - a.count)
    const monthly = [...this.complimentMonths].map(([key, count]) => { const [month, sender] = key.split('\u0000'); return { month, sender, count } }).sort((a, b) => a.month.localeCompare(b.month) || a.sender.localeCompare(b.sender))
    const callSenders: CallSenderStats[] = [...this.callCounts].map(([name, calls]) => {
      const durations = this.callDurations.get(name) || []
      const totalDurationSeconds = durations.reduce((sum, value) => sum + value, 0)
      return { name, calls, durationCount: durations.length, totalDurationSeconds, averageDurationSeconds: durations.length ? totalDurationSeconds / durations.length : null }
    }).sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))
    const callDailyPoints: CallDailyPoint[] = [...this.callDaily].map(([key, value]) => { const [date, sender] = key.split('\u0000'); return { date, sender, ...value } }).sort((a, b) => a.date.localeCompare(b.date) || a.sender.localeCompare(b.sender))
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
      words: this.wordCount, topWords: top(this.words, 100), emojis: top(this.emojis), kinds: top(this.kinds), threads: top(this.threads, 1000),
      compliments: { total: this.complimentTotal, senders: complimentSenders, monthly, examples: this.complimentExamples },
      calls: { totalCalls: this.totalCalls, durationCount: this.totalCallDurationCount, totalDurationSeconds: this.totalCallDurationSeconds, averageDurationSeconds: this.totalCallDurationCount ? this.totalCallDurationSeconds / this.totalCallDurationCount : null, senders: callSenders, daily: callDailyPoints },
      processingMs: performance.now() - this.started,
    }
  }
}

export function analyze(conversations: { conversation: Conversation; messages: Message[] }[], request: AnalysisRequest): Analysis {
  const analyzer = new Analyzer(request)
  for (const { conversation, messages } of conversations) analyzer.add(conversation, messages)
  return analyzer.finish()
}
