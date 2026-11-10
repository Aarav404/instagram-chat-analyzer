import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import type { Analysis } from '@/core/types'
import { compact, dateLabel, number } from '@/lib/utils'
import { Chart } from './Chart'

const axis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#888f89', fontSize: 11 }, splitLine: { lineStyle: { color: '#272c28', type: 'dashed' as const } } }
const tooltip = { trigger: 'axis' as const, renderMode: 'richText' as const, backgroundColor: '#232923', borderColor: '#3a433a', textStyle: { color: '#f0f2ee', fontSize: 12 }, padding: 12, confine: true }
export function Timeline({ analysis, split = false }: { analysis: Analysis; split?: boolean }) {
  const option = useMemo<EChartsOption>(() => ({
    grid: { left: 46, right: 16, top: 24, bottom: 55 },
    tooltip,
    xAxis: { ...axis, type: 'category', boundaryGap: false, data: analysis.daily.map((d) => d.date), axisLabel: { ...axis.axisLabel, hideOverlap: true, formatter: (value: string) => dateLabel(value) } },
    yAxis: { ...axis, type: 'value', minInterval: 1, axisLabel: { ...axis.axisLabel, formatter: (value: number) => compact(value) } },
    dataZoom: [{ type: 'inside', filterMode: 'none' }, { type: 'slider', height: 16, bottom: 4, borderColor: 'transparent', backgroundColor: '#1b201b', fillerColor: '#c3ee8d15', handleStyle: { color: '#63725a' }, dataBackground: { lineStyle: { color: '#46523e' }, areaStyle: { color: '#26321f' } }, selectedDataBackground: { lineStyle: { color: '#839570' }, areaStyle: { color: '#33422b' } }, textStyle: { color: '#8c938b' }, showDetail: false }],
    series: split ? [
      { name: 'You', type: 'bar', data: analysis.daily.map((d) => d.sent), stack: 'messages', itemStyle: { color: '#c3ee8d' }, barMaxWidth: 10, large: true },
      { name: 'Others', type: 'bar', data: analysis.daily.map((d) => d.received), stack: 'messages', itemStyle: { color: '#81b7f5' }, barMaxWidth: 10, large: true },
    ] : [
      { name: 'Messages', type: 'line', data: analysis.daily.map((d) => d.count), showSymbol: false, sampling: 'lttb', lineStyle: { color: '#7e9670', width: 1.2, opacity: .8 }, areaStyle: { color: '#c3ee8d', opacity: .035 }, itemStyle: { color: '#7e9670' } },
      { name: '7-day average', type: 'line', data: analysis.daily.map((d) => Math.round(d.average * 10) / 10), showSymbol: false, sampling: 'lttb', smooth: .2, lineStyle: { color: '#c3ee8d', width: 2.5 }, itemStyle: { color: '#c3ee8d' } },
    ],
  }), [analysis, split])
  return <Chart option={option} label={`Daily message activity from ${analysis.firstDate} to ${analysis.lastDate}. ${number(analysis.total)} messages.`} />
}
export function Ring({ value, color = '#c3ee8d', size = 112, label }: { value: number | null; color?: string; size?: number; label: string }) {
  const option = useMemo<EChartsOption>(() => ({
    series: [{ type: 'pie', radius: ['78%', '89%'], center: ['50%', '50%'], startAngle: 90, clockwise: true, silent: true, label: { show: false }, emphasis: { disabled: true }, data: [{ value: value ?? 0, itemStyle: { color, borderRadius: value && value < 100 ? 3 : 0 } }, { value: 100 - (value ?? 0), itemStyle: { color: '#303630' } }] }],
    graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: value === null ? '—' : value > 0 && value < 1 ? '<1%' : `${Math.round(value)}%`, fill: '#e9eee5', font: `500 ${size < 105 ? 20 : 25}px Inter Variable, sans-serif` } }],
  }), [value, color, size])
  return <div style={{ width: size, flexShrink: 0 }}><Chart option={option} height={size} label={`${label}: ${value === null ? 'not enough data' : value.toFixed(1) + '%'}`} /></div>
}
export function Heatmap({ analysis }: { analysis: Analysis }) {
  const option = useMemo<EChartsOption>(() => {
    const max = Math.max(1, ...analysis.heatmap.map((d) => d[2]))
    const hours = Array.from({ length: 24 }, (_, i) => `${i % 12 || 12}${i < 12 ? 'am' : 'pm'}`)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return {
      grid: { left: 46, right: 8, top: 28, bottom: 8 },
      tooltip: { ...tooltip, trigger: 'item', formatter: (params: unknown) => { const value = (params as { value: [number, number, number] }).value; return `${days[value[1]]}, ${hours[value[0]]}\n${number(value[2])} messages` } },
      xAxis: { ...axis, type: 'category', position: 'top', data: hours, splitArea: { show: false }, axisLabel: { color: '#9aa29b', fontSize: 10, interval: 0 } },
      yAxis: { ...axis, type: 'category', inverse: true, data: days, axisLabel: { color: '#a6afa6', fontSize: 11 } },
      visualMap: { show: false, min: 0, max, inRange: { color: ['#1b2126', '#183b55', '#246890', '#5fa8d1', '#b7e0f5'] } },
      series: [{ type: 'heatmap', data: analysis.heatmap.map((value) => ({ value, label: { color: value[2] > max * .66 ? '#102131' : '#c1cbd2' } })), itemStyle: { borderWidth: 3, borderColor: '#181c19', borderRadius: 3 }, label: { show: true, fontSize: 9, formatter: (p) => { const value = (p.value as number[])[2]; return value ? compact(value) : '·' } }, emphasis: { itemStyle: { borderColor: '#c3ee8d', borderWidth: 2 } } }],
    }
  }, [analysis])
  return <div className="heatmap-scroll"><div className="heatmap-inner"><Chart option={option} height={254} label="Messages by weekday and hour. Dark cells mean fewer messages; light blue cells mean more." /></div></div>
}
