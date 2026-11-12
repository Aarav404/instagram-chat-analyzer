import { useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import type { CallAnalytics } from '@/core/types'
import { COLORS, dateLabel, duration, number } from '@/lib/utils'
import { Chart } from './charts/Chart'
import { SectionTitle } from './shared'

type Metric = 'initiations' | 'average' | 'total'
const metrics: { id: Metric; label: string }[] = [
  { id: 'initiations', label: 'Initiations' },
  { id: 'average', label: 'Average duration' },
  { id: 'total', label: 'Total duration' },
]

export default function CallAnalyticsView({ calls }: { calls: CallAnalytics }) {
  const [metric, setMetric] = useState<Metric>('initiations')
  const dates = [...new Set(calls.daily.map((point) => point.date))]
  const option: EChartsOption = useMemo(() => ({
    grid: { left: 58, right: 95, top: 28, bottom: 55 },
    tooltip: { trigger: 'axis', backgroundColor: '#232923', borderColor: '#3a433a', textStyle: { color: '#f0f2ee' }, formatter: (items: unknown) => {
      const points = items as { seriesName: string; data: number | null; axisValue: string }[]
      return `${dateLabel(points[0]?.axisValue, true)}<br/>${points.map((point) => `${point.seriesName}: ${metric === 'initiations' ? number(point.data || 0) + ' calls' : duration(point.data)}`).join('<br/>')}`
    } },
    legend: { right: 0, top: 'middle', orient: 'vertical', textStyle: { color: '#a5ada3' }, type: 'scroll' },
    xAxis: { type: 'category', data: dates, axisLabel: { color: '#a5ada3', rotate: 30, hideOverlap: true, formatter: (value: string) => dateLabel(value) }, axisLine: { lineStyle: { color: '#414841' } } },
    yAxis: { type: 'value', minInterval: metric === 'initiations' ? 1 : undefined, axisLabel: { color: '#929a91', formatter: (value: number) => metric === 'initiations' ? number(value) : duration(value) }, splitLine: { lineStyle: { color: '#343a35' } } },
    series: calls.senders.map((sender, index) => ({ name: sender.name, type: 'line', smooth: 0.2, showSymbol: true, symbolSize: 6, connectNulls: false, lineStyle: { color: COLORS[index % COLORS.length], width: 2 }, itemStyle: { color: COLORS[index % COLORS.length] }, data: dates.map((date) => {
      const point = calls.daily.find((item) => item.date === date && item.sender === sender.name)
      if (!point) return metric === 'initiations' ? 0 : null
      if (metric === 'initiations') return point.calls
      if (metric === 'total') return point.totalDurationSeconds
      return point.durationCount ? point.totalDurationSeconds / point.durationCount : null
    }) })),
  }), [calls, dates, metric])

  return <div className="call-analytics">
    <section className="panel"><SectionTitle title="Call summary" subtitle="Who starts the call, and for how long." />
      <div className="call-summary-layout">
        <div className="call-starts"><h3>Initiations</h3><div className="call-sender-list">{calls.senders.map((sender, index) => <div key={sender.name}><span style={{ color: COLORS[index % COLORS.length] }}>{sender.name}</span><strong>{number(sender.calls)} {sender.calls === 1 ? 'call' : 'calls'}</strong></div>)}</div></div>
        <div className="call-durations"><h3>Durations</h3><div className="call-duration-stats"><div><span>Average call duration</span><strong>{duration(calls.averageDurationSeconds)}</strong></div><div><span>Total call duration</span><strong>{duration(calls.totalDurationSeconds)}</strong></div></div></div>
      </div>
    </section>
    <section className="panel"><SectionTitle title="Call trend" subtitle="Call activity over time." />
      <div className="call-trend-tabs" role="tablist" aria-label="Call trend metric">{metrics.map((item) => <button key={item.id} role="tab" aria-selected={metric === item.id} onClick={() => setMetric(item.id)}>{item.label}</button>)}</div>
      {dates.length ? <Chart key={metric} option={option} height={390} label={`${metric} per day, by caller.`} /> : <p className="text-sm text-muted-foreground">No dated calls.</p>}
    </section>
  </div>
}
