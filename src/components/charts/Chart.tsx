import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, CustomChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts'
import { AriaComponent, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption, ECElementEvent } from 'echarts'

echarts.use([BarChart, CustomChart, HeatmapChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, DataZoomComponent, GraphicComponent, AriaComponent, CanvasRenderer])
export interface ChartAction { label: string; select: () => void }
export function Chart({ option, height = 260, label, onPointClick, onCategoryClick, actions = [] }: { option: EChartsOption; height?: number; label: string; onPointClick?: (event: ECElementEvent) => void; onCategoryClick?: (category: string) => void; actions?: ChartAction[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const clickRef = useRef(onPointClick); clickRef.current = onPointClick
  const categoryRef = useRef(onCategoryClick); categoryRef.current = onCategoryClick
  const [dataOpen, setDataOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const instance = useRef<echarts.EChartsType | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas', devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2) })
    instance.current = chart
    chart.on('click', (event) => { if (event.componentType === 'series') clickRef.current?.(event); else if (event.componentType === 'yAxis' && typeof event.value === 'string') categoryRef.current?.(event.value) })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(ref.current)
    return () => { observer.disconnect(); chart.dispose(); instance.current = null }
  }, [])
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    instance.current?.setOption({ animationDuration: reduceMotion ? 0 : 350, animationDurationUpdate: reduceMotion ? 0 : 200, textStyle: { fontFamily: 'Inter Variable, sans-serif' }, ...option }, { notMerge: true })
  }, [option])
  return <><div ref={ref} style={{ width: '100%', height }} role="img" aria-label={label} tabIndex={onPointClick ? 0 : undefined} onPointerDown={() => { if (clickRef.current) ref.current?.focus({ preventScroll: true }) }} />
    {!!actions.length && <details className="chart-data-actions" onToggle={(event) => { setDataOpen(event.currentTarget.open); setOffset(0) }}><summary>View chart data</summary>{dataOpen && <div>
      {actions.slice(offset, offset + 50).map((action, index) => <button key={offset + index} onClick={action.select}>{action.label}</button>)}
      {actions.length > 50 && <nav aria-label="Chart data pages"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><button disabled={offset + 50 >= actions.length} onClick={() => setOffset(offset + 50)}>Next</button></nav>}
    </div>}</details>}
  </>
}
