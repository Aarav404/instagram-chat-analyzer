import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, Check, Search, Instagram, MessageCircle, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Help } from './ui/tooltip'
import { cn, initials } from '@/lib/utils'
import type { Platform } from '@/core/types'

export function PlatformIcon({ platform, size = 14 }: { platform: Platform; size?: number }) { return platform === 'instagram' ? <Instagram size={size} /> : <MessageCircle size={size} /> }
export function Avatar({ name, index = 0, small = false }: { name: string; index?: number; small?: boolean }) { return <span className={cn('avatar', `avatar-${index % 6}`, small && 'avatar-small')}>{initials(name)}</span> }
export function Loading({ text = 'Loading statistics…' }: { text?: string }) { return <div className="loading" role="status"><LoaderCircle size={20} className="animate-spin" /><span>{text}</span></div> }
export function EmptyState({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) { return <div className="empty-state"><MessageCircle size={28} strokeWidth={1.3} /><h3>{title}</h3>{description && <p>{description}</p>}{children}</div> }
export function SectionTitle({ title, subtitle, help, children }: { title: string; subtitle?: string; help?: string; children?: React.ReactNode }) { return <div className="section-heading"><div><h2>{title}{help && <Help text={help} label={`About ${title.toLowerCase()}`} />}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div> }
export function Footer() { return <footer className="footer"><span />Made by Aaloe<span /></footer> }

export function MultiSelect({ options, value, onChange, placeholder, label, triggerLabel }: { options: { value: string; label: string; detail?: string }[]; value: string[]; onChange: (value: string[]) => void; placeholder: string; label: string; triggerLabel?: string }) {
  const [query, setQuery] = useState('')
  const filtered = options.filter((option) => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({ count: filtered.length, getScrollElement: () => parentRef.current, estimateSize: () => 48, overscan: 5 })
  return <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-between font-normal" aria-label={label}><span className="truncate">{triggerLabel || (value.length ? `${value.length} selected` : placeholder)}</span><ChevronDown /></Button></PopoverTrigger><PopoverContent className="w-[min(360px,calc(100vw-3rem))]">
    <div className="search-input mb-2"><Search size={15} /><input aria-label={`Search ${label.toLowerCase()}`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" /></div>
    <div ref={parentRef} className="max-h-64 overflow-auto" style={{ height: Math.min(256, filtered.length * 48) }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => { const option = filtered[row.index]; const checked = value.includes(option.value); return <button type="button" role="checkbox" aria-checked={checked} key={option.value} onClick={() => onChange(checked ? value.filter((v) => v !== option.value) : [...value, option.value])} className="select-option" style={{ position: 'absolute', top: 0, transform: `translateY(${row.start}px)`, height: 48 }}><span className={cn('checkbox', checked && 'checked')}>{checked && <Check size={12} />}</span><span className="truncate">{option.label}{option.detail && <small>{option.detail}</small>}</span></button> })}
      </div>
    </div>
    {!filtered.length && <p className="p-3 text-xs text-muted-foreground">No matches.</p>}
  </PopoverContent></Popover>
}
