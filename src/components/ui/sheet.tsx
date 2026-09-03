'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A sheet/drawer built on Radix Dialog. On phones it slides up from the bottom
 * and is height-capped so the page behind stays visible; from `sm` up it
 * becomes a right-hand panel. Radix handles focus trapping and scroll locking.
 */

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export const SheetTitle = DialogPrimitive.Title
export const SheetDescription = DialogPrimitive.Description

export const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function SheetOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-ink-900/45 backdrop-blur-[2px]',
        'data-[state=open]:animate-[fade-in_0.18s_ease-out]',
        className,
      )}
      {...props}
    />
  )
})

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: 'bottom' | 'right'
}

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(function SheetContent({ className, children, side = 'bottom', ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 flex flex-col bg-cream-50 shadow-[var(--shadow-lift)] focus:outline-none',
          side === 'bottom'
            ? 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl data-[state=open]:animate-[slide-up_0.26s_cubic-bezier(0.22,1,0.36,1)]'
            : 'inset-y-0 right-0 w-full max-w-md data-[state=open]:animate-[in-up_0.24s_cubic-bezier(0.22,1,0.36,1)]',
          // Right-side panels look wrong on a phone, so keep bottom below `sm`.
          side === 'right' ? 'sm:rounded-none' : 'sm:inset-x-auto sm:right-0 sm:inset-y-0 sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})

export function SheetHeader({
  title,
  description,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-cream-200 px-4 py-4 sm:px-5',
        className,
      )}
    >
      <div className="min-w-0">
        <SheetTitle className="text-lg font-bold text-ink-900">{title}</SheetTitle>
        {description ? (
          <SheetDescription className="mt-0.5 text-sm text-ink-500">{description}</SheetDescription>
        ) : null}
      </div>
      <SheetClose
        aria-label="Close"
        className="-mr-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-500 transition-colors hover:bg-cream-200 hover:text-ink-900"
      >
        <X className="size-5" />
      </SheetClose>
    </div>
  )
}
