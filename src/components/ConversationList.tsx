import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDownWideNarrow, ArrowUpRight, Search } from 'lucide-react'
import type { Conversation } from '@/core/types'
import { dateLabel, number } from '@/lib/utils'
import { Avatar, EmptyState, PlatformIcon } from './shared'

export default function ConversationList({ conversations, onSelect }: { conversations: Conversation[]; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState(''), [platform, setPlatform] = useState('all'), [sort, setSort] = useState('messages')
  const parent = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => conversations.filter((c) => (platform === 'all' || c.platform === platform) && `${c.title} ${c.participants.join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => sort === 'recent' ? (b.lastTimestamp || 0) - (a.lastTimestamp || 0) : sort === 'name' ? a.title.localeCompare(b.title) : b.messageCount - a.messageCount), [conversations, search, platform, sort])
  const virtualizer = useVirtualizer({ count: filtered.length, getScrollElement: () => parent.current, estimateSize: () => 80, overscan: 8 })
  const max = conversations[0]?.messageCount || 1
  return <section className="panel library-panel"><div className="library-tools"><div className="search-input"><Search size={16} /><input aria-label="Search conversations" placeholder="Find a person or conversation…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="flex gap-2"><select aria-label="Filter platform" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="all">All platforms</option><option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option></select><label className="sort-control"><ArrowDownWideNarrow size={15} /><select aria-label="Sort conversations" value={sort} onChange={(e) => setSort(e.target.value)}><option value="messages">Most messages</option><option value="recent">Recently active</option><option value="name">Name A–Z</option></select></label></div></div>
    <div className="conversation-head"><span>CONVERSATION · {number(filtered.length)}</span><span>MESSAGES</span><span>LAST ACTIVE</span><span /></div>
    {!filtered.length && <EmptyState title="No conversations found" description="Try a different name or platform." />}
    <div ref={parent} className="conversation-scroll" style={{ height: Math.min(640, filtered.length * 80) }}><div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>{virtualizer.getVirtualItems().map((row) => { const c = filtered[row.index]; return <button key={c.id} className="conversation-row" aria-label={`View ${c.title}`} onClick={() => onSelect(c.id)} style={{ position: 'absolute', top: 0, transform: `translateY(${row.start}px)`, height: row.size }}><span className="conversation-person"><Avatar name={c.title} index={row.index} /><span><strong>{c.title}</strong><small><PlatformIcon platform={c.platform} />{c.platform} · {c.participants.length} accounts</small></span></span><span className="conversation-count"><strong>{number(c.messageCount)}</strong><span className="rank-track"><span style={{ width: `${c.messageCount / max * 100}%` }} /></span></span><span className="last-active">{dateLabel(c.lastTimestamp, true)}</span><ArrowUpRight size={16} /></button> })}</div></div>
  </section>
}
