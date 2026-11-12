export type Platform = 'instagram' | 'whatsapp'
export type CalculationMode = 'standard' | 'legacy'
export type ShareMode = 'auto' | 'sides' | 'participants'
export type MessageKind = 'text' | 'photo' | 'video' | 'audio' | 'link' | 'call' | 'attachment'

export interface Message {
  id: string
  conversationId: string
  sender: string
  timestamp: number | null
  text: string
  kind: MessageKind
  callDurationSeconds?: number
}
export interface Conversation {
  id: string
  title: string
  titleSource?: 'export' | 'participants'
  platform: Platform
  participants: string[]
  messageCount: number
  firstTimestamp: number | null
  lastTimestamp: number | null
  importedAt: number
  revision: number
  isDemo?: boolean
}
export interface ParsedPage {
  conversationId: string
  title: string
  titleSource?: 'export' | 'participants'
  platform: Platform
  participants: string[]
  messages: Message[]
  warnings: string[]
}
export interface StoredPage {
  id: string
  conversationId: string
  source: string
  digest: string
  messages: Message[]
}
export interface ChatGroup { id: string; name: string; conversationIds: string[] }
export interface Settings { ownerNames: string[]; identityConfirmed: boolean; calculationMode: CalculationMode; shareMode: ShareMode }
export interface Library { conversations: Conversation[]; groups: ChatGroup[]; settings: Settings }
export interface Filters { from: string; to: string; sender: string; platform: Platform | 'all'; query: string }
export const EMPTY_FILTERS: Filters = { from: '', to: '', sender: '', platform: 'all', query: '' }
export interface AnalysisRequest { conversationIds: string[]; filters: Filters; groupName?: string; settings: Settings }
export interface CountItem { name: string; count: number }
export interface SenderStats extends CountItem {
  share: number
  medianReplySeconds: number | null
  averageReplySeconds: number | null
  withinSessionMedianSeconds: number | null
  betweenSessionAverageSeconds: number | null
  doubleTexts: number
  initiations: number
}
export interface DailyPoint { date: string; count: number; average: number; sent: number; received: number }
export type ComplimentCategory = 'Personality' | 'Appearance' | 'Ability' | 'Affection / humor'
export interface ComplimentSender { name: string; count: number; perThousand: number; topCategory: ComplimentCategory | null; categories: Record<ComplimentCategory, number>; phrases: CountItem[] }
export interface ComplimentExample { sender: string; text: string; timestamp: number | null; category: ComplimentCategory; phrase: string }
export interface Compliments { total: number; senders: ComplimentSender[]; monthly: { month: string; sender: string; count: number }[]; examples: ComplimentExample[] }
export interface CallSenderStats { name: string; calls: number; durationCount: number; totalDurationSeconds: number; averageDurationSeconds: number | null }
export interface CallDailyPoint { date: string; sender: string; calls: number; totalDurationSeconds: number; durationCount: number }
export interface CallAnalytics { totalCalls: number; durationCount: number; totalDurationSeconds: number; averageDurationSeconds: number | null; senders: CallSenderStats[]; daily: CallDailyPoint[] }
export interface Analysis {
  total: number
  datedTotal: number
  firstDate: string | null
  lastDate: string | null
  activeDays: number
  busiestDay: { date: string; count: number } | null
  streak: { days: number; start: string | null; end: string | null }
  averageReplySeconds: number | null
  daily: DailyPoint[]
  heatmap: [number, number, number][]
  shares: (CountItem & { share: number })[]
  senders: SenderStats[]
  engagement: number | null
  delayScore: number | null
  averageSessionReplySeconds: number | null
  doubleTexts: number
  doubleTextScore: number
  initiations: number
  initiationScore: number
  words: number
  topWords: CountItem[]
  emojis: CountItem[]
  kinds: CountItem[]
  threads: CountItem[]
  compliments: Compliments
  calls: CallAnalytics
  processingMs: number
}
export interface ImportProgress { phase: string; completed: number; total: number; messages: number }
export interface ImportReport { imported: number; skipped: number; messages: number; warnings: string[]; durationMs: number; cancelled: boolean }
export interface ImportOptions { dateOrder: 'DMY' | 'MDY' }
export type SenderSelection = { kind: 'identity'; name: string } | { kind: 'side'; side: 'you' | 'others' }
export type MessageSelection = { title: string; sender?: SenderSelection } & (
  | { kind: 'compliment'; phrase?: string; month?: string }
  | { kind: 'day'; date: string }
  | { kind: 'word'; word: string }
  | { kind: 'emoji'; emoji: string }
  | { kind: 'type'; messageKind: MessageKind }
)
export interface TextRange { start: number; end: number }
export interface MatchedMessage extends Message { highlights?: TextRange[] }
export type OpenMessages = (selection: MessageSelection) => void
export interface MessagePage { messages: MatchedMessage[]; total: number; offset: number }
export interface WorkerMethods {
  library: { input: undefined; output: Library }
  import: { input: { files: File[]; options: ImportOptions }; output: ImportReport }
  analyze: { input: AnalysisRequest; output: Analysis }
  messages: { input: { request: AnalysisRequest; offset: number; limit: number; selection?: MessageSelection; search?: string }; output: MessagePage }
  saveSettings: { input: Settings; output: Settings }
  saveGroup: { input: ChatGroup; output: ChatGroup[] }
  removeGroup: { input: string; output: ChatGroup[] }
  deleteConversation: { input: string; output: Library }
  clear: { input: undefined; output: undefined }
  demo: { input: undefined; output: Library }
}
export type WorkerRequest = { [K in keyof WorkerMethods]: { id: number; method: K; input: WorkerMethods[K]['input'] } }[keyof WorkerMethods]
export type WorkerResponse = { id: number; result?: unknown; error?: string; progress?: ImportProgress }
