import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export function DialogContent({ className, children, variant = 'default', ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { variant?: 'default' | 'drawer' }) {
  // Keep placement exclusive: centering utilities must never reach a drawer.
  // Production CSS can fold translate:none into transform, leaving Tailwind's
  // independent translate property active if both layouts share those classes.
  const placement = variant === 'drawer'
    ? 'message-drawer'
    : 'left-1/2 top-1/2 grid max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-2xl'
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className={cn('fixed inset-0 z-50 data-[state=open]:animate-in', variant === 'drawer' ? 'bg-black/30' : 'bg-black/70')} /><DialogPrimitive.Content className={cn('fixed z-50 border border-border bg-popover p-6 shadow-2xl focus:outline-none', placement, className)} {...props}>
    {children}<DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close dialog"><X className="size-4" /></DialogPrimitive.Close>
  </DialogPrimitive.Content></DialogPrimitive.Portal>
}
export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) { return <div className={cn('flex flex-col gap-2 pr-6', className)} {...props} /> }
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) { return <DialogPrimitive.Title className={cn('text-xl font-semibold tracking-tight', className)} {...props} /> }
export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) { return <DialogPrimitive.Description className={cn('text-sm leading-relaxed text-muted-foreground', className)} {...props} /> }
export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) { return <div className={cn('flex justify-end gap-2 pt-2', className)} {...props} /> }
