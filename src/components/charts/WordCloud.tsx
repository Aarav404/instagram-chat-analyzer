import { useEffect, useMemo, useRef, useState } from 'react'
import type { EChartsOption } from 'echarts'
import type { Analysis, OpenMessages } from '@/core/types'
import { number } from '@/lib/utils'
import { Chart } from './Chart'
import { layoutCloud, type CloudEntry, type CloudWord } from './cloud-layout'
import { STOP_WORDS } from '@/core/stop-words'

export default function WordCloud({ analysis, onOpenMessages }: { analysis: Analysis; onOpenMessages: OpenMessages }) {
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [placed, setPlaced] = useState<CloudWord[]>([])
  const height = width < 420 ? 360 : Math.min(520, Math.max(400, Math.round(width * .43)))
  const entries = useMemo<CloudEntry[]>(() => [
    ...analysis.topWords.filter((word) => !STOP_WORDS.has(word.name)).map((word) => ({ ...word, kind: 'word' as const })),
    ...analysis.emojis.map((emoji) => ({ ...emoji, kind: 'emoji' as const })),
  ].filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 100), [analysis.topWords, analysis.emojis])

  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    setPlaced([])
    if (width < 40 || !entries.length) return
    // Place largest first. Yield between small batches so resizing never locks the UI.
    void document.fonts.ready.then(async () => {
      if (cancelled) return
      const result = await layoutCloud(entries, width, height, () => cancelled)
      if (!cancelled) setPlaced(result)
    })
    return () => { cancelled = true }
  }, [entries, width, height])

  const option = useMemo<EChartsOption>(() => ({
    animation: false,
    tooltip: { trigger: 'item', renderMode: 'html', confine: true, enterable: false, transitionDuration: 0, extraCssText: 'pointer-events:none;', backgroundColor: '#232923', borderColor: '#3a433a', textStyle: { color: '#f0f2ee' }, formatter: (params) => {
      const item = placed[(Array.isArray(params) ? params[0] : params).dataIndex]
      const content = document.createElement('div')
      content.style.whiteSpace = 'pre-line'
      content.textContent = item ? `${item.name}\n${number(item.count)} occurrences` : ''
      return content
    } },
    series: [{
      type: 'custom', coordinateSystem: 'none', cursor: 'pointer',
      data: placed.map((entry) => ({ name: entry.name, value: entry.count })),
      renderItem: (params) => {
        const entry = placed[params.dataIndex]
        return { type: 'image', x: entry.x, y: entry.y, emphasisDisabled: true, style: { image: entry.image, width: entry.width, height: entry.height } }
      },
    }],
  }), [placed])
  const select = (entry: CloudEntry) => onOpenMessages(entry.kind === 'emoji'
    ? { kind: 'emoji', emoji: entry.name, title: `Messages containing ${entry.name}` }
    : { kind: 'word', word: entry.name, title: `Messages matching “${entry.name}”` })
  return <div ref={container} className="word-cloud">
    {!entries.length ? <p className="text-sm text-muted-foreground">No words or emoji in this selection.</p> : <>
      {!!width && <Chart option={option} height={height} label="Word cloud. Larger words and emoji occur more often." onPointClick={(event) => { const entry = placed[event.dataIndex]; if (entry) select(entry) }} actions={entries.map((entry) => ({ label: `${entry.name} · ${number(entry.count)} occurrences`, select: () => select(entry) }))} />}
      {!placed.length && <span className="sr-only" role="status">Arranging word cloud…</span>}
    </>}
  </div>
}
