import type { ReactNode } from 'react'
import type { TextRange } from '@/core/types'

export function HighlightedText({ text, ranges = [] }: { text: string; ranges?: TextRange[] }) {
  const merged: TextRange[] = []
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1)
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }
  const output: ReactNode[] = []
  let cursor = 0
  for (const { start, end } of merged) {
    output.push(text.slice(cursor, start), <mark className="compliment-highlight" key={`${start}-${end}`}>{text.slice(start, end)}</mark>)
    cursor = end
  }
  output.push(text.slice(cursor))
  return <>{output}</>
}
