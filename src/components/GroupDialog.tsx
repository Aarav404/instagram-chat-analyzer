import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ChatGroup, Conversation } from '@/core/types'
import { worker } from '@/lib/worker-client'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { MultiSelect, PlatformIcon } from './shared'

export function GroupDialog({ open, onOpenChange, conversations, group, onSaved }: { open: boolean; onOpenChange: (value: boolean) => void; conversations: Conversation[]; group?: ChatGroup; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(''), [members, setMembers] = useState<string[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setName(group?.name || ''); setMembers(group?.conversationIds || []); setError('') } }, [open, group])
  async function save() {
    setBusy(true); setError('')
    try { await worker.call('saveGroup', { id: group?.id || crypto.randomUUID(), name, conversationIds: members }); await onSaved(); onOpenChange(false) }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent aria-describedby={undefined}><DialogHeader><DialogTitle>{group ? 'Edit group' : 'Create group'}</DialogTitle></DialogHeader>
    <label className="field-label">Group name<input maxLength={100} placeholder="e.g. Maya" value={name} onChange={(e) => setName(e.target.value)} /></label>
    <p className="text-xs text-muted-foreground">Accounts selected under “Your accounts” count as You. The remaining accounts count as the person named above.</p>
    <div className="field-label"><span>Add conversations</span><MultiSelect label="Group members" placeholder="Choose conversations…" value={members} options={conversations.map((c) => ({ value: c.id, label: c.title, detail: `${c.platform} · ${c.messageCount.toLocaleString()} messages` }))} onChange={setMembers} /></div>
    {members.length > 0 && <div className="selected-members">{members.map((id) => { const c = conversations.find((item) => item.id === id); return c && <span key={id}><PlatformIcon platform={c.platform} />{c.title}<button aria-label={`Remove ${c.title} from group`} onClick={() => setMembers(members.filter((item) => item !== id))}><X size={12} /></button></span> })}</div>}
    {error && <p role="alert" className="error-banner">{error}</p>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!name.trim() || !members.length || busy} onClick={save}>{busy ? 'Saving…' : 'Finalize group'}</Button></DialogFooter>
  </DialogContent></Dialog>
}
