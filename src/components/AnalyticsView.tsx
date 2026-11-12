import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowRight, CalendarDays, Clock3, Flame, MessageCircle } from 'lucide-react'
import type { Analysis, AnalysisRequest, Conversation, Library, MessageSelection, OpenMessages, MessageKind } from '@/core/types'
import { combinesGroupAccounts } from '@/core/sender-identity'
import { useAnalysis } from '@/hooks/use-analysis'
import { COLORS, compact, csvCell, dateLabel, duration, number, saveFile } from '@/lib/utils'
import { Avatar, EmptyState, Loading, SectionTitle } from './shared'
import { Help } from './ui/tooltip'
import { Button } from './ui/button'

const Timeline = lazy(() => import('./charts/AnalyticsCharts').then((m) => ({ default: m.Timeline })))
const Ring = lazy(() => import('./charts/AnalyticsCharts').then((m) => ({ default: m.Ring })))
const WordCloud = lazy(() => import('./charts/WordCloud'))
const Heatmap = lazy(() => import('./charts/AnalyticsCharts').then((m) => ({ default: m.Heatmap })))
const MatchingMessages = lazy(() => import('./MatchingMessages'))
const MessageBrowser = lazy(() => import('./MessageBrowser'))
const ComplimentsView = lazy(() => import('./ComplimentsView'))
const CallAnalyticsView = lazy(() => import('./CallAnalyticsView'))

const HELP = {
  engagement: 'A measure of message-count balance, not affection or relationship quality. The smallest nonzero sender share divided by the largest, multiplied by 100. Equal counts give 100%. In a custom group, your aliases count as You.',
  delay: '100 minus the average reply delay in minutes, clamped between 0 and 100. Only replies during a session (gaps of at most six hours) count. This is the original app’s score; a higher score means faster replies.',
  doubles: 'An additional consecutive message from the same sender within a conversation session. The ring shows double texts as a share of dated messages.',
  initiations: 'The first message starts a session. After more than six hours of silence, the next message starts another. The ring shows session starts as a share of dated messages; the table shows who started them.',
  replies: 'Average time between adjacent messages from different senders, including gaps up to seven days. In the standard mode, messages in different source conversations are never treated as replies to one another.',
}

function Summary({ analysis, showFirstMessage }: { analysis: Analysis; showFirstMessage: boolean }) {
  return <div className={`summary-grid${showFirstMessage ? ' summary-with-first' : ''}`}>
    <Stat label="Total messages" value={number(analysis.total)} detail={`${number(analysis.activeDays)} active days`} icon={<MessageCircle size={16} />} />
    <Stat label="Busiest day" value={analysis.busiestDay ? dateLabel(analysis.busiestDay.date) : '—'} detail={analysis.busiestDay ? `${number(analysis.busiestDay.count)} messages · ${analysis.busiestDay.date.slice(0, 4)}` : 'No dated messages'} icon={<CalendarDays size={16} />} />
    {showFirstMessage && <Stat label="First message" value={dateLabel(analysis.firstDate)} detail={analysis.firstDate ? `${analysis.firstDate.slice(0, 4)} · Last active ${dateLabel(analysis.lastDate, true)}` : 'No dated messages'} icon={<CalendarDays size={16} />} />}
    <Stat label="Longest active streak" value={`${analysis.streak.days}`} suffix="days" detail={analysis.streak.start ? `${dateLabel(analysis.streak.start)} – ${dateLabel(analysis.streak.end)}` : 'No active days'} icon={<Flame size={16} />} help="Consecutive calendar days with at least one message. Every active day counts, even if only one person sent a message." />
    <Stat label="Average reply" value={duration(analysis.averageReplySeconds)} detail="" icon={<Clock3 size={16} />} help={HELP.replies} />
  </div>
}
function Stat({ label, value, detail, icon, suffix, help }: { label: string; value: string; detail: string; icon: React.ReactNode; suffix?: string; help?: string }) { return <div className="stat-card"><div className="stat-label"><span>{label}{help && <Help text={help} label={`About ${label.toLowerCase()}`} />}</span>{icon}</div><div className="stat-value">{value}{suffix && <small>{suffix}</small>}</div>{detail && <p>{detail}</p>}</div> }

function Shares({ analysis, onShareMode, shareMode, combined }: { combined: boolean; analysis: Analysis; shareMode: string; onShareMode: (value: 'auto' | 'sides' | 'participants') => void }) {
  // Use analytics-specific classes: social-widget filters hide `.share-row`.
  return <section className="panel sender-breakdown-panel"><SectionTitle title="Messages by sender" />{!combined && <select className="compact-select mb-3" aria-label="Sender share display" value={shareMode} onChange={(e) => onShareMode(e.target.value as 'auto' | 'sides' | 'participants')}><option value="auto">Automatic grouping</option><option value="sides">You / others</option><option value="participants">Each account</option></select>}
    <div className="sender-breakdown-list">{analysis.shares.map((share, i) => <div className="sender-breakdown-row" key={share.name}><Ring value={share.share} color={COLORS[i % COLORS.length]} size={92} label={`${share.name}’s message share`} /><div className="min-w-0"><h3><i style={{ backgroundColor: COLORS[i % COLORS.length] }} />{share.name}</h3><p>{number(share.count)} messages</p></div></div>)}</div>
    {!analysis.shares.length && <p className="text-sm text-muted-foreground">No messages in this selection.</p>}
  </section>
}

function Patterns({ analysis, combined }: { analysis: Analysis; combined: boolean }) {
  const scores = [
    { title: 'Engagement', value: analysis.engagement, note: 'Message balance', help: HELP.engagement },
    { title: 'Delay score', value: analysis.delayScore, note: analysis.averageSessionReplySeconds === null ? 'No replies in a session' : `${duration(analysis.averageSessionReplySeconds)} average delay`, help: HELP.delay },
    { title: 'Double texts', value: analysis.doubleTextScore, note: `${number(analysis.doubleTexts)} additional messages`, help: HELP.doubles },
    { title: 'Initiations', value: analysis.initiationScore, note: `${number(analysis.initiations)} conversations started`, help: HELP.initiations },
  ]
  return <section className="panel"><SectionTitle title="Conversation patterns" /><div className="patterns-grid">{scores.map((score, i) => <div className="pattern" key={score.title}><h3>{score.title}<Help text={score.help} label={`About ${score.title.toLowerCase()}`} /></h3><Ring value={score.value} color={COLORS[i]} label={score.title} /><p>{score.note}</p></div>)}</div>
    <details className="sender-details"><summary>Breakdown by sender <span>{analysis.senders.length} {combined ? 'people' : 'accounts'}</span></summary><div className="table-scroll"><table><thead><tr><th>Sender</th><th>Median reply <Help text="Median of different-sender reply gaps up to seven days. Includes pauses between sessions." /></th><th>During sessions <Help text="Median reply delay when the gap is at most six hours." /></th><th>Between sessions <Help text="Average preceding silence for sessions this account initiated after a gap of more than six hours." /></th><th>Double texts</th><th>Initiations</th></tr></thead><tbody>{analysis.senders.map((s) => <tr key={s.name}><td>{s.name}</td><td>{duration(s.medianReplySeconds)}</td><td>{duration(s.withinSessionMedianSeconds)}</td><td>{duration(s.betweenSessionAverageSeconds)}</td><td>{number(s.doubleTexts)}</td><td>{number(s.initiations)}</td></tr>)}</tbody></table></div></details>
  </section>
}

function Ranking({ conversations, onSelect }: { conversations: Conversation[]; onSelect: (id: string) => void }) {
  const max = conversations[0]?.messageCount || 1
  return <section className="panel"><SectionTitle title="Conversations by message count" /><div className="ranking-list">{conversations.slice(0, 6).map((c, i) => <button key={c.id} onClick={() => onSelect(c.id)} className="rank-row"><span className="rank-number">{String(i + 1).padStart(2, '0')}</span><Avatar name={c.title} index={i} small /><span className="rank-content"><strong>{c.title}</strong><span className="rank-track"><span style={{ width: `${c.messageCount / max * 100}%` }} /></span></span><span className="rank-count">{compact(c.messageCount)}</span><ArrowRight size={14} /></button>)}</div></section>
}

function Details({ analysis, onOpenMessages }: { analysis: Analysis; onOpenMessages: OpenMessages }) {
  return <div className="details-grid"><section className="panel word-cloud-panel"><SectionTitle title="Word cloud" /><WordCloud analysis={analysis} onOpenMessages={onOpenMessages} /></section><div className="details-cards"><section className="panel"><SectionTitle title="Most used emoji" /><div className="emoji-list">{analysis.emojis.slice(0, 12).map((e) => <button className="message-drilldown" key={e.name} aria-label={`View messages containing ${e.name}`} onClick={() => onOpenMessages({ kind: 'emoji', emoji: e.name, title: `Messages containing ${e.name}` })}><span>{e.name}</span><small>{number(e.count)}</small></button>)}</div>{!analysis.emojis.length && <p className="text-sm text-muted-foreground">No emoji.</p>}</section><section className="panel"><SectionTitle title="Message types" /><div className="type-list">{analysis.kinds.map((item) => <button className="message-drilldown" key={item.name} aria-label={`View ${item.name} messages`} onClick={() => onOpenMessages({ kind: 'type', messageKind: item.name as MessageKind, title: `${item.name.charAt(0).toUpperCase() + item.name.slice(1)} messages` })}><span>{item.name}</span><strong>{number(item.count)}</strong></button>)}</div></section></div></div>
}

export default function AnalyticsView({ request, library, overview, onSelect, onShareMode }: { request: AnalysisRequest; library: Library; overview: boolean; onSelect: (id: string) => void; onShareMode: (value: 'auto' | 'sides' | 'participants') => void }) {
  const [tab, setTab] = useState('overview'), [split, setSplit] = useState(false)
  const revision = library.conversations.map((c) => `${c.id}:${c.revision}`).join(',')
  const [selection, setSelection] = useState<MessageSelection | null>(null)
  const requestKey = JSON.stringify(request)
  useEffect(() => { setSelection(null) }, [requestKey, revision, tab])
  const { analysis, loading, error } = useAnalysis(request, revision)
  const showCallsTab = !overview && !request.groupName && request.conversationIds.length === 1 && (analysis?.calls.durationCount || 0) > 0
  const tabs = ['overview', 'activity', 'compliments', ...(showCallsTab ? ['calls'] : []), 'details', 'messages']
  function exportStats() {
    if (!analysis) return
    const csv = [['Date', 'Messages', '7-day average', 'You', 'Others'], ...analysis.daily.map((d) => [d.date, d.count, d.average.toFixed(3), d.sent, d.received])].map((row) => row.map(csvCell).join(',')).join('\r\n')
    saveFile('aaloe-lyzer-daily-statistics.csv', csv, 'text/csv;charset=utf-8')
  }
  if (error) return <div className="error-banner" role="alert">{error}</div>
  if (!analysis) return loading ? <Loading /> : <EmptyState title="No conversations selected" />
  return <div className={loading ? 'analytics updating' : 'analytics'} aria-busy={loading}>
    <div className="tabs-row"><div className="tabs" role="tablist" aria-label="Analytics views">{tabs.map((item) => <button role="tab" aria-selected={tab === item} key={item} onClick={() => setTab(item)}>{item.charAt(0).toUpperCase() + item.slice(1)}</button>)}</div><Button variant="ghost" size="sm" onClick={exportStats}><ArrowDownToLine />Export stats</Button></div>
    {loading && <span className="sr-only" role="status">Updating statistics</span>}
    <Suspense fallback={<Loading text="Loading charts…" />}>
      {tab === 'messages' ? <MessageBrowser request={request} /> : tab === 'compliments' ? <ComplimentsView onOpenMessages={setSelection} analysis={analysis} overview={overview} /> : tab === 'calls' && showCallsTab ? <CallAnalyticsView calls={analysis.calls} /> : !analysis.total ? <EmptyState title="No messages match these filters" /> : tab === 'details' ? <Details onOpenMessages={setSelection} analysis={analysis} /> : <>
        <Summary analysis={analysis} showFirstMessage={!overview} />
        <div className={tab === 'activity' ? '' : 'timeline-grid'}>
          <section className="panel timeline-panel"><SectionTitle title="Daily message activity"><button className="chart-toggle" onClick={() => setSplit(!split)}>{split ? 'Show trend' : 'By sender'}</button></SectionTitle><div className="chart-legend"><span><i style={{ background: split ? COLORS[0] : '#7e9670' }} />{split ? 'You' : 'Daily messages'}</span><span><i style={{ background: split ? COLORS[1] : COLORS[0] }} />{split ? 'Others' : request.settings.calculationMode === 'legacy' ? '7 active-day average' : '7-day average'}</span></div><Timeline onOpenMessages={setSelection} analysis={analysis} split={split} /></section>
          {tab !== 'activity' && <Shares combined={combinesGroupAccounts(request)} analysis={analysis} shareMode={request.settings.shareMode} onShareMode={onShareMode} />}
        </div>
        {overview && tab === 'overview' && <div className="overview-middle"><Ranking conversations={library.conversations.filter((c) => request.conversationIds.includes(c.id)).map((c) => ({ ...c, messageCount: analysis.threads.find((t) => t.name === c.id)?.count ?? 0 })).filter((c) => c.messageCount > 0).sort((a, b) => b.messageCount - a.messageCount)} onSelect={onSelect} /></div>}
        {tab === 'overview' && <Patterns combined={combinesGroupAccounts(request)} analysis={analysis} />}
        <section className="panel heatmap-panel"><SectionTitle title="Activity by day and hour" help={`Times use ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`}><div className="heat-key"><span>Less</span>{['#1b2126', '#183b55', '#246890', '#5fa8d1', '#b7e0f5'].map((c) => <i style={{ background: c }} key={c} />)}<span>More</span></div></SectionTitle><Heatmap analysis={analysis} /></section>
      </>}
    </Suspense>
    {selection && <Suspense fallback={<Loading text="Opening messages…" />}><MatchingMessages request={request} selection={selection} onClose={() => setSelection(null)} /></Suspense>}
  </div>
}
