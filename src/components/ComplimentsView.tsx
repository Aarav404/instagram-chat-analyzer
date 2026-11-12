import { useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import type { Analysis, OpenMessages } from '@/core/types'
import { csvCell, dateLabel, number, saveFile } from '@/lib/utils'
import { Chart } from './charts/Chart'
import { EmptyState, SectionTitle } from './shared'
import { Button } from './ui/button'

const categories = ['Personality', 'Appearance', 'Ability', 'Affection / humor'] as const
const palette = ['#c3ee8d', '#81b7f5', '#f1b77b', '#c9a4ec', '#78d5c7', '#f08d8d']

function highlightedText(text: string, phrases: string[]) {
  const ranges: { start: number; end: number }[] = []
  for (const phrase of phrases) {
    const needle = phrase.toLocaleLowerCase()
    if (!needle) continue
    let from = 0
    while (from < text.length) {
      const start = text.toLocaleLowerCase().indexOf(needle, from)
      if (start < 0) break
      ranges.push({ start, end: start + phrase.length })
      from = start + Math.max(1, phrase.length)
    }
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: { start: number; end: number }[] = []
  for (const range of ranges) {
    const last = merged.at(-1)
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }
  const output: React.ReactNode[] = []
  let cursor = 0
  for (const [index, range] of merged.entries()) {
    if (cursor < range.start) output.push(text.slice(cursor, range.start))
    output.push(<mark className="compliment-highlight" key={index}>{text.slice(range.start, range.end)}</mark>)
    cursor = range.end
  }
  if (cursor < text.length) output.push(text.slice(cursor))
  return output
}

export default function ComplimentsView({ analysis, overview, onOpenMessages }: { analysis: Analysis; overview: boolean; onOpenMessages: OpenMessages }) {
  const [shuffleSeed, setShuffleSeed] = useState(0)
  const senders = analysis.compliments.senders
  const topPhrases = useMemo(() => {
    const totals = new Map<string, number>()
    for (const sender of senders) for (const phrase of sender.phrases) totals.set(phrase.name, (totals.get(phrase.name) || 0) + phrase.count)
    return [...totals].map(([phrase, count]) => ({ phrase, count })).sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase)).slice(0, 12)
  }, [senders])
  const categoryTotals = useMemo(() => categories.map((category) => ({ category, count: senders.reduce((sum, sender) => sum + sender.categories[category], 0) })).sort((a, b) => b.count - a.count), [senders])
  const overallTopCategory = categoryTotals[0]?.count ? categoryTotals[0].category : null
  const breakdown: EChartsOption = useMemo(() => ({
    grid: { left: 118, right: 24, top: 38, bottom: 18, containLabel: false },
    tooltip: { trigger: 'axis', backgroundColor: '#232923', borderColor: '#3a433a', textStyle: { color: '#f0f2ee' } },
    xAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#929a91' }, splitLine: { lineStyle: { color: '#343a35' } } },
    yAxis: { type: 'category', triggerEvent: true, inverse: true, data: topPhrases.map((item) => item.phrase), axisLabel: { color: '#a5ada3', width: 100, overflow: 'truncate', formatter: (value: string) => value.length > 22 ? `${value.slice(0, 21)}…` : value }, axisLine: { lineStyle: { color: '#414841' } } },
    series: overview
      ? [{ name: 'Compliments', type: 'bar', cursor: 'pointer', barMaxWidth: 24, itemStyle: { color: '#81b7f5', borderRadius: [0, 3, 3, 0] }, data: topPhrases.map((item) => ({ name: item.phrase, value: item.count })) }]
      : senders.map((sender, i) => ({ name: sender.name, type: 'bar', cursor: 'pointer', barMaxWidth: 20, itemStyle: { color: palette[i % palette.length], borderRadius: [0, 3, 3, 0] }, data: topPhrases.map((item) => ({ name: item.phrase, value: sender.phrases.find((phrase) => phrase.name === item.phrase)?.count || 0 })) })),
  }), [overview, senders, topPhrases])
  const months = useMemo(() => [...new Set(analysis.compliments.monthly.map((point) => point.month))], [analysis.compliments.monthly])
  const trend: EChartsOption = useMemo(() => ({
    grid: { left: 48, right: 30, top: 25, bottom: 55 },
    tooltip: { trigger: 'axis', backgroundColor: '#232923', borderColor: '#3a433a', textStyle: { color: '#f0f2ee' } },
    legend: { right: 8, top: 0, textStyle: { color: '#a5ada3' } },
    xAxis: { type: 'category', data: months, axisLabel: { color: '#a5ada3', rotate: 25 }, axisLine: { lineStyle: { color: '#414841' } } },
    yAxis: { type: 'value', minInterval: 1, name: 'Compliments', nameTextStyle: { color: '#929a91' }, axisLabel: { color: '#929a91' }, splitLine: { lineStyle: { color: '#343a35' } } },
    series: overview
      ? [{ name: 'Compliments', type: 'line', cursor: 'pointer', smooth: 0.2, showSymbol: true, symbolSize: 6, lineStyle: { color: '#81b7f5', width: 2 }, itemStyle: { color: '#81b7f5' }, areaStyle: { opacity: 0.08 }, data: months.map((month) => analysis.compliments.monthly.filter((point) => point.month === month).reduce((sum, point) => sum + point.count, 0)) }]
      : senders.map((sender, i) => ({ name: sender.name, type: 'line', cursor: 'pointer', smooth: 0.2, showSymbol: true, symbolSize: 6, lineStyle: { color: palette[i % palette.length], width: 2 }, itemStyle: { color: palette[i % palette.length] }, areaStyle: { opacity: 0.08 }, data: months.map((month) => analysis.compliments.monthly.filter((point) => point.sender === sender.name && point.month === month).reduce((sum, point) => sum + point.count, 0)) })),
  }), [analysis.compliments.monthly, months, overview, senders])
  const examples = useMemo(() => {
    const grouped = new Map<string, { sender: string; text: string; timestamp: number | null; category: string; phrases: string[] }>()
    for (const item of analysis.compliments.examples) {
      const key = `${item.sender}\u0000${item.timestamp}\u0000${item.text}`
      const existing = grouped.get(key)
      if (existing) { if (!existing.phrases.includes(item.phrase)) existing.phrases.push(item.phrase) }
      else grouped.set(key, { sender: item.sender, text: item.text, timestamp: item.timestamp, category: item.category, phrases: [item.phrase] })
    }
    const unique = [...grouped.values()]
    let seed = shuffleSeed + 1
    const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647 }
    return [...unique].sort(() => random() - 0.5).slice(0, 6)
  }, [analysis.compliments.examples, shuffleSeed])

  function openPhrase(phrase: string, sender?: string) {
    onOpenMessages({ kind: 'compliment', phrase, title: `Messages matching “${phrase}”${sender ? ` · ${sender}` : ''}`, ...(sender ? { sender: { kind: 'identity', name: sender } as const } : {}) })
  }
  function openMonth(month: string, sender?: string) {
    onOpenMessages({ kind: 'compliment', month, title: `Compliments · ${month}${sender ? ` · ${sender}` : ''}`, ...(sender ? { sender: { kind: 'identity', name: sender } as const } : {}) })
  }
  const phraseActions = topPhrases.flatMap((item) => [
    { label: `${item.phrase} · ${number(item.count)} matches`, select: () => openPhrase(item.phrase) },
    ...(!overview ? senders.filter((sender) => sender.phrases.some((phrase) => phrase.name === item.phrase)).map((sender) => ({ label: `${item.phrase} · ${sender.name}`, select: () => openPhrase(item.phrase, sender.name) })) : []),
  ])
  const monthActions = overview ? months.map((month) => ({ label: month, select: () => openMonth(month) })) : analysis.compliments.monthly.map((point) => ({ label: `${point.month} · ${point.sender} · ${number(point.count)} matches`, select: () => openMonth(point.month, point.sender) }))

  function exportBreakdown() {
    const rows: (string | number)[][] = [['Compliment phrase', 'Count']]
    for (const item of topPhrases) rows.push([item.phrase, item.count])
    saveFile('aaloe-lyzer-compliments.csv', rows.map((row) => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  }

  if (!senders.length) return <EmptyState title="No compliments detected" description="Try a different conversation, group, or filter." />
  return <div className="compliments-view">
    <section className="panel"><SectionTitle title="Compliment summary" subtitle="Who’s spreading the love?" /><div className="compliment-summaries">{overview ? <article className="compliment-summary"><h3>Everyone</h3><div><span>Total<strong>{number(analysis.compliments.total)}</strong></span><span>Per 1,000 msgs<strong>{(analysis.compliments.total / Math.max(analysis.total, 1) * 1000).toFixed(2)}</strong></span><span>Top category<strong>{overallTopCategory || '—'}</strong></span></div></article> : senders.map((sender, i) => <article key={sender.name} className="compliment-summary"><h3 style={{ borderColor: palette[i % palette.length] }}>{sender.name}</h3><div><span>Total<strong>{number(sender.count)}</strong></span><span>Per 1,000 msgs<strong>{sender.perThousand.toFixed(2)}</strong></span><span>Top category<strong>{sender.topCategory || '—'}</strong></span></div></article>)}</div></section>
    <section className="panel"><SectionTitle title="Most used compliments" subtitle="Compliment phrases, ranked by count."><Button variant="outline" size="sm" onClick={exportBreakdown}>Export</Button></SectionTitle>{topPhrases.length ? <Chart option={breakdown} actions={phraseActions} onCategoryClick={(phrase) => { if (topPhrases.some((item) => item.phrase === phrase)) openPhrase(phrase) }} onPointClick={(event) => { if (topPhrases.some((item) => item.phrase === event.name)) openPhrase(event.name, overview ? undefined : event.seriesName) }} height={Math.min(360, Math.max(220, topPhrases.length * 34 + 72))} label="Top compliment phrases by sender, shown as horizontal bars." /> : <p className="text-sm text-muted-foreground">No compliment phrases found.</p>}</section>
    <section className="panel"><SectionTitle title="Compliment examples" subtitle="Matched messages from the chat."><Button variant="outline" size="sm" onClick={() => setShuffleSeed((value) => value + 1)}>Shuffle</Button></SectionTitle><div className="compliment-examples">{examples.map((example, index) => <blockquote key={`${example.sender}-${example.timestamp}-${index}`}><p>“{highlightedText(example.text, example.phrases)}”</p><footer>{example.sender} · {example.category}{example.timestamp !== null && ` · ${dateLabel(example.timestamp, true)}`}</footer></blockquote>)}</div></section>
    <section className="panel"><SectionTitle title="Compliments over time" subtitle="Tracking the warmth, month by month." />{months.length ? <Chart option={trend} actions={monthActions} onPointClick={(event) => { if (months.includes(event.name)) openMonth(event.name, overview ? undefined : event.seriesName) }} height={330} label="Monthly compliment phrase counts by sender." /> : <p className="text-sm text-muted-foreground">No dated compliments.</p>}</section>
  </div>
}
