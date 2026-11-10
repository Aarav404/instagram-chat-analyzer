import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts'
import { AriaComponent, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'

echarts.use([BarChart, HeatmapChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, DataZoomComponent, GraphicComponent, AriaComponent, CanvasRenderer])
export function Chart({ option, height = 260, label }: { option: EChartsOption; height?: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const instance = useRef<echarts.EChartsType | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas', devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2) })
    instance.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(ref.current)
    return () => { observer.disconnect(); chart.dispose(); instance.current = null }
  }, [])
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    instance.current?.setOption({ animationDuration: reduceMotion ? 0 : 350, animationDurationUpdate: reduceMotion ? 0 : 200, textStyle: { fontFamily: 'Inter Variable, sans-serif' }, ...option }, { notMerge: true })
  }, [option])
  return <div ref={ref} style={{ width: '100%', height }} role="img" aria-label={label} />
}
