'use client'

import * as React from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { cn } from '@/lib/utils'
import { buttonVariants } from './button'

/**
 * Confirmation gate for destructive actions. Uses Radix AlertDialog so it is
 * announced correctly and cannot be dismissed by an accidental outside tap.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: {
  trigger: React.ReactNode
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  async function handleConfirm(event: React.MouseEvent) {
    event.preventDefault()
    setPending(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink-900/45 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_0.18s_ease-out]" />
        <AlertDialog.Content
          className={cn(
            'fixed z-50 bg-cream-50 shadow-[var(--shadow-lift)] focus:outline-none',
            'inset-x-0 bottom-0 rounded-t-3xl p-5',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            'data-[state=open]:animate-[in-up_0.22s_cubic-bezier(0.22,1,0.36,1)]',
          )}
        >
          <AlertDialog.Title className="text-lg font-bold text-ink-900">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-ink-500">
            {description}
          </AlertDialog.Description>
          <div className="safe-bottom mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className={cn(buttonVariants({ variant: 'outline' }))}>
              {cancelLabel}
            </AlertDialog.Cancel>
            <button
              type="button"
              disabled={pending}
              onClick={handleConfirm}
              className={cn(
                buttonVariants({ variant: destructive ? 'destructive' : 'primary' }),
                'disabled:opacity-60',
              )}
            >
              {pending ? 'Working…' : confirmLabel}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
