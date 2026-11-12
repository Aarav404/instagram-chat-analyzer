import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { ArrowRight, ArrowUpRight, BookOpen, ChevronRight, Instagram, LayoutGrid, Layers, Menu, MessageCircle, Plus, Trash2, X } from 'lucide-react'
import type { AnalysisRequest, ChatGroup, Filters as FilterState, Library, Settings as Preferences } from './core/types'
import { EMPTY_FILTERS } from './core/types'
import { withConversationTitle } from './core/conversation-title'
import { senderIdentity } from './core/sender-identity'
import { isIgnoredSender } from './core/normalize'
import { worker } from './lib/worker-client'
import { compact, number } from './lib/utils'
import { Button } from './components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog'
import { TooltipProvider } from './components/ui/tooltip'
import { Footer, Avatar, EmptyState, Loading, MultiSelect } from './components/shared'
import { ImportDialog, ImportForm } from './components/ImportDialog'
import { GroupDialog } from './components/GroupDialog'
import { Filters } from './components/Filters'

const AnalyticsView = lazy(() => import('./components/AnalyticsView'))
const ConversationList = lazy(() => import('./components/ConversationList'))
const Guide = lazy(() => import('./components/Guide'))

type Page = 'overview' | 'conversations' | 'groups' | 'guide' | `chat:${string}` | `group:${string}`
function readPage(): Page {
  try { const page = decodeURIComponent(window.location.hash.slice(1)); if (/^(overview|conversations|groups|guide|chat:.+|group:.+)$/.test(page)) return page as Page } catch { /* Invalid bookmark falls back to overview. */ }
  return 'overview'
}

export default function App() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [page, setPage] = useState<Page>(readPage)
  const [error, setError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [deleteDataOpen, setDeleteDataOpen] = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ChatGroup | undefined>()
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS })
  const [mobileOpen, setMobileOpen] = useState(false)
  const refresh = useCallback(async () => { const data = await worker.call('library', undefined); setLibrary(data) }, [])

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message))
    const listener = () => { setPage(readPage()); setFilters({ ...EMPTY_FILTERS }) }
    window.addEventListener('hashchange', listener)
    return () => window.removeEventListener('hashchange', listener)
  }, [refresh])

  function navigate(next: Page) {
    setPage(next)
    window.location.hash = next
    setFilters({ ...EMPTY_FILTERS })
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
  }

  async function updatePreferences(patch: Partial<Preferences>) {
    if (!library) return
    const previous = library.settings
    const settings = { ...previous, ...patch }
    if (patch.ownerNames) setFilters((current) => ({ ...current, sender: '' }))
    setLibrary((current) => current && { ...current, settings, conversations: current.conversations.map((conversation) => withConversationTitle(conversation, settings.ownerNames)) })
    try { await worker.call('saveSettings', settings) }
    catch (e) { setLibrary((current) => current && { ...current, settings: previous, conversations: current.conversations.map((conversation) => withConversationTitle(conversation, previous.ownerNames)) }); setError((e as Error).message) }
  }

  async function deleteAllData() {
    setDeletingData(true)
    setError('')
    try {
      await worker.call('clear', undefined)
      await refresh()
      setFilters({ ...EMPTY_FILTERS })
      navigate('overview')
      setDeleteDataOpen(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeletingData(false)
    }
  }

  const conversations = library?.conversations || []
  const total = conversations.reduce((n, c) => n + c.messageCount, 0)
  const hasData = !!conversations.length
  const allDemo = hasData && conversations.every((c) => c.isDemo)
  const selected = page.startsWith('chat:') ? conversations.find((c) => c.id === page.slice(5)) : undefined
  const group = page.startsWith('group:') ? library?.groups.find((g) => g.id === page.slice(6)) : undefined
  const isOverview = page === 'overview'
  const isAnalytics = isOverview || !!selected || !!group
  const selectionMissing = (page.startsWith('chat:') && !selected) || (page.startsWith('group:') && !group)
  const selectedIds = selected ? [selected.id] : group ? group.conversationIds : conversations.map((c) => c.id)
  const request: AnalysisRequest | null = library ? { conversationIds: selectedIds, filters, groupName: group?.name, settings: library.settings } : null
  const senders = [...new Set(conversations.filter((c) => selectedIds.includes(c.id)).flatMap((c) => c.participants).filter((name) => !isIgnoredSender(name)).map((name) => request ? senderIdentity(name, request) : name))].sort()
  const accountNames = [...new Set(conversations.flatMap((c) => c.participants))].sort()
  const navItems = [{ id: 'overview' as Page, label: 'Overview', icon: LayoutGrid }, { id: 'conversations' as Page, label: 'Conversations', icon: MessageCircle }, { id: 'groups' as Page, label: 'Groups', icon: Layers }]
  const pageTitle = selected?.title || group?.name || ({ overview: 'Overview', conversations: 'Conversations', groups: 'Groups', guide: 'Import guide' } as Record<string, string>)[page] || 'Conversation'
  const showImportHome = library && !hasData && (isOverview || page === 'conversations')

  function createGroup() { setEditingGroup(undefined); setGroupOpen(true) }
  function editGroup(value: ChatGroup) { setEditingGroup(value); setGroupOpen(true) }

  return <TooltipProvider delayDuration={200}><div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    {mobileOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => navigate('overview')} aria-label="aaloe-lyzer home"><span className="brand-mark"><MessageCircle size={19} strokeWidth={2.5} /></span><span>aaloe-lyzer</span></button>
      <nav aria-label="Main navigation">{navItems.map((item) => <button key={item.id} className={`nav-item ${page === item.id || (item.id === 'conversations' && selected) || (item.id === 'groups' && group) ? 'active' : ''}`} onClick={() => navigate(item.id)}>
        <item.icon size={17} /><span>{item.label}</span>
        {item.id === 'conversations' && hasData && <small>{conversations.length}</small>}
        {item.id === 'groups' && !!library?.groups.length && <small>{library.groups.length}</small>}
      </button>)}</nav>
      {hasData && <div className="sidebar-library"><span className="nav-caption">Platforms</span><div><Instagram size={14} /><span>Instagram</span><small>{conversations.filter((c) => c.platform === 'instagram').length}</small></div><div><MessageCircle size={14} /><span>WhatsApp</span><small>{conversations.filter((c) => c.platform === 'whatsapp').length}</small></div></div>}
      {!!library?.groups.length && <div className="sidebar-groups"><span className="nav-caption">Saved groups</span>{library.groups.slice(0, 5).map((g) => <button key={g.id} onClick={() => navigate(`group:${g.id}`)}><span className="group-dot" /><span>{g.name}</span></button>)}</div>}
      <div className="sidebar-bottom">
        <button className={`nav-item ${page === 'guide' ? 'active' : ''}`} onClick={() => navigate('guide')}><BookOpen size={17} /><span>Import guide</span><ArrowUpRight size={13} /></button>
        <button className="nav-item delete-data-button" onClick={() => setDeleteDataOpen(true)}><Trash2 size={17} /><span>Delete data</span></button>
      </div>
    </aside>

    <div className="app-main">
      <header className="topbar">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(!mobileOpen)}><Menu /></Button><span className="breadcrumb">aaloe-lyzer<ChevronRight size={12} /><strong>{pageTitle}</strong></span></div>
        <div className="topbar-actions">
          {hasData && library && <div className="account-select"><MultiSelect label="Your accounts" triggerLabel="Your accounts" placeholder="Select your accounts" options={accountNames.map((name) => ({ value: name, label: name }))} value={library.settings.ownerNames} onChange={(ownerNames) => { void updatePreferences({ ownerNames, identityConfirmed: true }) }} /></div>}
          {!showImportHome && <Button size="sm" onClick={() => setImportOpen(true)}><Plus />Import chats</Button>}
        </div>
      </header>
      <main id="main-content" className="main-content">
        {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
      {!library && !error && <Loading text="Loading conversations…" />}
        {allDemo && <div className="demo-banner"><span>Sample data</span><button onClick={() => setImportOpen(true)}>Import chats<ArrowRight size={13} /></button></div>}
        {showImportHome ? <section className="import-home">
          <div className="page-heading"><h1>Chat statistics</h1></div>
          <ImportForm onImported={async () => { await refresh(); navigate('overview') }} onGuide={() => navigate('guide')} />
        </section> : library && <>
          <div className="page-heading">
            <div>{selected || group ? <div className="conversation-title"><Avatar name={pageTitle} /><div><h1>{pageTitle}</h1><p>{group ? `${group.conversationIds.length} conversations` : `${selected?.participants.length} accounts · ${number(selected?.messageCount || 0)} messages`}</p></div></div> : <><h1>{isOverview ? 'Chat statistics' : pageTitle}</h1>{isOverview && <p>{number(total)} messages · {conversations.length} conversations</p>}</>}</div>
            {isAnalytics && hasData && <Filters value={filters} onChange={setFilters} senders={senders} calculationMode={library.settings.calculationMode} onCalculationMode={(calculationMode) => { void updatePreferences({ calculationMode }) }} />}
            {page === 'groups' && <Button disabled={!hasData} onClick={createGroup}><Plus />Create group</Button>}
            {group && <Button variant="outline" size="sm" onClick={() => editGroup(group)}>Edit group</Button>}
          </div>
          <Suspense fallback={<Loading />}>
            {selectionMissing ? <EmptyState title="Conversation not found"><Button variant="outline" onClick={() => navigate('conversations')}>Back to conversations</Button></EmptyState>
              : isAnalytics && request && hasData ? <AnalyticsView key={page} request={request} library={library} overview={isOverview} onSelect={(id) => navigate(`chat:${id}`)} onShareMode={(shareMode) => { void updatePreferences({ shareMode }) }} />
              : page === 'conversations' ? <ConversationList conversations={conversations} onSelect={(id) => navigate(`chat:${id}`)} />
              : page === 'groups' ? <Groups library={library} onOpen={(id) => navigate(`group:${id}`)} onEdit={editGroup} onNew={createGroup} onRemove={async (id) => { try { await worker.call('removeGroup', id); await refresh() } catch (e) { setError((e as Error).message) } }} />
              : page === 'guide' ? <Guide onImport={() => setImportOpen(true)} /> : null}
          </Suspense>
        </>}
        <Footer />
      </main>
    </div>
    <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={refresh} replaceDemo={allDemo} onGuide={() => navigate('guide')} />
    <GroupDialog open={groupOpen} onOpenChange={setGroupOpen} conversations={conversations} group={editingGroup} onSaved={refresh} />
    <Dialog open={deleteDataOpen} onOpenChange={(open) => { if (!deletingData) setDeleteDataOpen(open) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete all data?</DialogTitle>
          <DialogDescription>This clears all imported chats, saved groups, and preferences. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={deletingData} onClick={() => setDeleteDataOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={deletingData} onClick={() => void deleteAllData()}>{deletingData ? 'Deleting…' : 'Delete data'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Analytics />
  </div></TooltipProvider>
}

function Groups({ library, onOpen, onEdit, onNew, onRemove }: { library: Library; onOpen: (id: string) => void; onEdit: (g: ChatGroup) => void; onNew: () => void; onRemove: (id: string) => void }) {
  if (!library.groups.length) return <section className="panel"><EmptyState title="No groups"><Button onClick={onNew} disabled={!library.conversations.length}><Plus />Create group</Button></EmptyState></section>
  return <div className="groups-grid">{library.groups.map((g) => {
    const members = library.conversations.filter((c) => g.conversationIds.includes(c.id))
    return <section className="panel group-card" key={g.id}>
      <div className="flex items-center justify-between"><Avatar name={g.name} /><span className="group-tag"><Layers size={12} />Group</span></div>
      <h2>{g.name}</h2><p>{members.length} conversations · {compact(members.reduce((sum, c) => sum + c.messageCount, 0))} messages</p>
      <div className="group-members">{members.map((c) => <span key={c.id}>{c.title}</span>)}</div>
      <div className="group-actions"><Button variant="outline" size="sm" onClick={() => onOpen(g.id)}>View stats<ArrowRight /></Button><Button variant="ghost" size="sm" onClick={() => onEdit(g)}>Edit</Button><button className="remove-group" onClick={() => onRemove(g.id)}>Remove</button></div>
    </section>
  })}</div>
}
