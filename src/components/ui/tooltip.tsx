import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { CircleHelp } from 'lucide-react'
export const TooltipProvider = TooltipPrimitive.Provider
export function Help({ text, label = 'About this statistic' }: { text: string; label?: string }) {
  return <TooltipPrimitive.Root><TooltipPrimitive.Trigger asChild><button type="button" className="help-icon" aria-label={label}><CircleHelp size={14} /></button></TooltipPrimitive.Trigger><TooltipPrimitive.Portal><TooltipPrimitive.Content sideOffset={7} className="z-[70] max-w-xs rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-foreground shadow-xl">{text}<TooltipPrimitive.Arrow className="fill-border" /></TooltipPrimitive.Content></TooltipPrimitive.Portal></TooltipPrimitive.Root>
}
