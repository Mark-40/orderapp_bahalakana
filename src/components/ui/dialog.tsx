'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Centred modal for admin forms. Below `sm` it docks to the bottom of the
 * screen like a native sheet, which is far easier to reach one-handed.
 */

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string }
>(function DialogContent({ className, children, title, description, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-900/45 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_0.18s_ease-out]" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 flex flex-col bg-cream-50 shadow-[var(--shadow-lift)] focus:outline-none',
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl',
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg',
          'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          'data-[state=open]:animate-[in-up_0.22s_cubic-bezier(0.22,1,0.36,1)]',
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3 border-b border-cream-200 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-lg font-bold text-ink-900">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-sm text-ink-500">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className="-mr-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-500 transition-colors hover:bg-cream-200 hover:text-ink-900"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto px-4 py-4 sm:px-5', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'safe-bottom flex flex-col-reverse gap-2 border-t border-cream-200 px-4 py-3 sm:flex-row sm:justify-end sm:px-5',
        className,
      )}
      {...props}
    />
  )
}
