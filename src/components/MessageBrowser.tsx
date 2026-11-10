import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type { AnalysisRequest, MessagePage } from '@/core/types'
import { worker } from '@/lib/worker-client'
import { dateLabel, number } from '@/lib/utils'
import { Button } from './ui/button'
import { Avatar, EmptyState, Loading } from './shared'

export default function MessageBrowser({ request }: { request: AnalysisRequest }) {
  const [data, setData] = useState<MessagePage | null>(null), [search, setSearch] = useState(''), [offset, setOffset] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(true)
  const parent = useRef<HTMLDivElement>(null)
  const key = JSON.stringify(request)
  const requestRef = useRef(request); requestRef.current = request
  useEffect(() => { setOffset(0) }, [search, key])
  useEffect(() => {
    let active = true
    setBusy(true); setError('')
    const timer = setTimeout(() => worker.call('messages', { request: { ...requestRef.current, filters: { ...requestRef.current.filters, query: search || requestRef.current.filters.query } }, offset, limit: 100 }).then((result) => { if (active) { setData(result); parent.current?.scrollTo(0, 0) } }).catch((e: Error) => { if (active) setError(e.message) }).finally(() => { if (active) setBusy(false) }), 220)
    return () => { active = false; clearTimeout(timer) }
  }, [key, search, offset])
  const virtualizer = useVirtualizer({ count: data?.messages.length || 0, getScrollElement: () => parent.current, estimateSize: () => 112, overscan: 6 })
  return <section className="panel"><div className="message-toolbar"><div className="search-input"><Search size={16} /><input aria-label="Search messages" placeholder="Find a message…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="text-xs text-muted-foreground">Newest first</span></div>
    {error && <p role="alert" className="error-banner">{error}</p>}
    {busy && <Loading text="Reading messages…" />}
    {!busy && !data?.total && <EmptyState title="No matching messages" />}
    <div ref={parent} className="message-list" style={{ display: busy || !data?.total ? 'none' : undefined }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => { const message = data!.messages[row.index]; const own = request.settings.ownerNames.includes(message.sender); return <article key={message.id} data-index={row.index} ref={virtualizer.measureElement} className="message-row" style={{ position: 'absolute', top: 0, width: '100%', transform: `translateY(${row.start}px)` }}><Avatar name={message.sender} index={own ? 0 : 1} small /><div className="min-w-0 flex-1"><div className="message-meta"><strong>{own ? `${message.sender} (you)` : message.sender}</strong><time>{message.timestamp === null ? 'Undated' : `${dateLabel(message.timestamp, true)} · ${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</time></div><p>{message.text || `[${message.kind}]`}</p>{message.kind !== 'text' && <span className="message-kind">{message.kind}</span>}</div></article> })}
      </div>
    </div>
    {!!data?.total && <div className="pagination"><span>{number(offset + 1)}–{number(Math.min(offset + 100, data.total))} of {number(data.total)}</span><div className="flex gap-2"><Button variant="outline" size="sm" aria-label="Previous messages" disabled={busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}><ChevronLeft /></Button><Button variant="outline" size="sm" aria-label="Next messages" disabled={busy || offset + 100 >= data.total} onClick={() => setOffset(offset + 100)}><ChevronRight /></Button></div></div>}
  </section>
}
