import { useRef } from 'react'
import type { AnalysisRequest, MessageSelection } from '@/core/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import MessageBrowser from './MessageBrowser'

export default function MatchingMessages({ request, selection, onClose }: { request: AnalysisRequest; selection: MessageSelection; onClose: () => void }) {
  const previousFocus = useRef(document.activeElement)
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent variant="drawer" aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); if (previousFocus.current instanceof HTMLElement && previousFocus.current.isConnected) previousFocus.current.focus({ preventScroll: true }) }}>
      <DialogHeader><DialogTitle>{selection.title}</DialogTitle></DialogHeader>
      <MessageBrowser key={JSON.stringify(selection)} request={request} selection={selection} />
    </DialogContent>
  </Dialog>
}
