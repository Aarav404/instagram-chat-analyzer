import { useRef, useState } from 'react'
import { Archive, ArrowUpRight, FileText, FolderOpen, LoaderCircle, Plus, Upload, X } from 'lucide-react'
import type { ImportProgress, ImportReport } from '@/core/types'
import { worker } from '@/lib/worker-client'
import { number } from '@/lib/utils'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface ImportFormProps {
  onImported: () => Promise<void>
  replaceDemo?: boolean
  onGuide: () => void
  onBusyChange?: (busy: boolean) => void
}

export function ImportForm({ onImported, replaceDemo = false, onGuide, onBusyChange }: ImportFormProps) {
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState<'instagram' | 'whatsapp' | null>(null)
  const [dateOrder, setDateOrder] = useState<'DMY' | 'MDY'>('DMY')
  const [hasWhatsApp, setHasWhatsApp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState('')
  const instagramRef = useRef<HTMLInputElement>(null)
  const whatsappRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  function addFiles(incoming: File[], platform: 'instagram' | 'whatsapp') {
    setReport(null)
    setError('')
    const supported = incoming.filter((file) => /\.(zip|json|txt)$/i.test(file.name) && !file.webkitRelativePath.includes('__MACOSX'))
    if (!supported.length) { setError('Choose an Instagram ZIP or JSON export, an inbox folder, or a WhatsApp TXT export.'); return }
    if (supported.some((file) => file.size > 5 * 1024 ** 3)) { setError('The maximum size is 5 GB per file.'); return }
    if (platform === 'whatsapp' || supported.some((file) => /\.txt$/i.test(file.name))) setHasWhatsApp(true)
    setFiles((current) => [...current, ...supported.filter((file) => !current.some((old) => old.name === file.name && old.webkitRelativePath === file.webkitRelativePath && old.size === file.size && old.lastModified === file.lastModified))])
  }

  async function start() {
    if (!files.length) return
    setBusy(true)
    onBusyChange?.(true)
    setError('')
    setReport(null)
    try {
      if (replaceDemo) await worker.call('clear', undefined)
      const result = await worker.call('import', { files, options: { dateOrder } }, setProgress)
      setReport(result)
      setFiles([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setBusy(false)
      onBusyChange?.(false)
      setProgress(null)
    }
  }

  const percent = progress?.total ? Math.round(progress.completed / progress.total * 100) : 0
  return <div className="import-form">
    <input ref={instagramRef} type="file" multiple accept=".zip,.json" className="sr-only" aria-label="Choose Instagram files" onChange={(e) => { addFiles(Array.from(e.target.files || []), 'instagram'); e.target.value = '' }} />
    <input ref={whatsappRef} type="file" multiple accept=".txt,.zip" className="sr-only" aria-label="Choose WhatsApp files" onChange={(e) => { addFiles(Array.from(e.target.files || []), 'whatsapp'); e.target.value = '' }} />
    <input ref={folderRef} type="file" multiple {...{ webkitdirectory: '' }} className="sr-only" aria-label="Choose inbox folder" onChange={(e) => { addFiles(Array.from(e.target.files || []), 'instagram'); e.target.value = '' }} />

    {!busy && !report && <>
      {(['instagram', 'whatsapp'] as const).map((platform) => <section className="import-field" key={platform}>
        <div className="import-field-heading"><h2>{platform === 'instagram' ? 'Instagram export' : 'WhatsApp export'}</h2>{platform === 'instagram' && <button className="text-link" onClick={() => folderRef.current?.click()}><FolderOpen size={13} />Choose inbox folder</button>}</div>
        <div className={`file-drop ${dragging === platform ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(platform) }} onDragLeave={() => setDragging(null)} onDrop={(e) => { e.preventDefault(); setDragging(null); addFiles(Array.from(e.dataTransfer.files), platform) }}>
          <Upload size={19} strokeWidth={1.5} />
        <div><span>Drop files here</span><small>{platform === 'instagram' ? 'ZIP or JSON' : 'TXT or ZIP'} · Up to 5 GB per file</small></div>
          <Button variant="outline" size="sm" onClick={() => (platform === 'instagram' ? instagramRef : whatsappRef).current?.click()}>Browse files</Button>
        </div>
      </section>)}
      {files.length > 0 && <div className="file-list">
        <div className="flex justify-between mb-2"><span>{number(files.length)} files selected</span><button onClick={() => { setFiles([]); setHasWhatsApp(false) }} className="text-muted-foreground hover:text-foreground">Clear</button></div>
        {files.slice(0, 3).map((file, index) => <div className="file-row" key={`${file.webkitRelativePath}-${file.name}-${index}`}>
          {/\.zip$/i.test(file.name) ? <Archive size={16} /> : <FileText size={16} />}<span>{file.name}</span><small>{(file.size / 1024 ** 2).toFixed(1)} MB</small>
          <button aria-label={`Remove ${file.name}`} onClick={() => setFiles((old) => old.filter((_, i) => i !== index))}><X size={13} /></button>
        </div>)}
        {files.length > 3 && <small className="text-muted-foreground">and {files.length - 3} more</small>}
      </div>}
      {hasWhatsApp && files.length > 0 && <label className="field-label">WhatsApp date format<select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as 'DMY' | 'MDY')}><option value="DMY">Day / month / year (31/12/26)</option><option value="MDY">Month / day / year (12/31/26)</option></select></label>}
      {replaceDemo && <p className="text-xs text-muted-foreground">Importing chats replaces the sample data.</p>}
    </>}

    {busy && <div className="import-progress" role="status" aria-live="polite">
      <LoaderCircle className="animate-spin text-primary" size={24} />
      <h3>{progress?.phase || 'Preparing import…'}</h3>
      {progress?.total ? <p>{number(progress.completed)} of {number(progress.total)} files · {number(progress.messages)} messages</p> : null}
      <div className="progress-track"><div style={{ width: `${Math.max(3, percent)}%` }} /></div>
      <Button variant="outline" size="sm" onClick={() => worker.cancelImport()}>Cancel import</Button>
    </div>}

    {report && <div className="import-result">
      <h3>{report.cancelled ? 'Import cancelled' : report.imported ? 'Import complete' : report.skipped ? 'Files already imported' : 'No conversations imported'}</h3>
      <p>{number(report.imported)} conversations added or updated · {number(report.messages)} messages</p>
      {report.skipped > 0 && <small>{number(report.skipped)} unchanged or empty files skipped.</small>}
      {report.warnings.length > 0 && <details className="warning-details"><summary>{report.warnings.length} import notes</summary><ul>{report.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
    </div>}

    {error && <p role="alert" className="error-banner">{error}</p>}
    {!busy && <div className="import-actions">
      {report ? <>
        <Button variant="outline" size="sm" onClick={() => setReport(null)}><Plus />Add more</Button>
        <Button onClick={() => { void onImported().catch((e: Error) => setError(e.message)) }}>View conversations</Button>
      </> : <>
        <button className="text-link" onClick={onGuide}>Import guide<ArrowUpRight size={13} /></button>
        <div className="flex gap-2">{error && <Button variant="outline" onClick={() => { void onImported().catch((e: Error) => setError(e.message)) }}>View imported chats</Button>}<Button disabled={!files.length} onClick={start}>Import chats</Button></div>
      </>}
    </div>}
  </div>
}

export function ImportDialog({ open, onOpenChange, onImported, replaceDemo, onGuide }: { open: boolean; onOpenChange: (open: boolean) => void; onImported: () => Promise<void>; replaceDemo: boolean; onGuide: () => void }) {
  const [busy, setBusy] = useState(false)
  async function finish() { await onImported(); onOpenChange(false) }
  return <Dialog open={open} onOpenChange={(next) => { if (!busy) { if (!next) void onImported(); onOpenChange(next) } }}>
    <DialogContent aria-describedby={undefined} onInteractOutside={(e) => { if (busy) e.preventDefault() }} onEscapeKeyDown={(e) => { if (busy) e.preventDefault() }}>
      <DialogHeader><DialogTitle>Import chats</DialogTitle></DialogHeader>
      <ImportForm onImported={finish} replaceDemo={replaceDemo} onGuide={() => { onOpenChange(false); onGuide() }} onBusyChange={setBusy} />
    </DialogContent>
  </Dialog>
}
