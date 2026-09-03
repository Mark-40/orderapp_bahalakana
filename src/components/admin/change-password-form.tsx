'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { changePasswordAction, type ActionState } from '@/server/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} className="sm:w-44">
      {pending ? 'Updating' : 'Update password'}
    </Button>
  )
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(changePasswordAction, {})
  const formRef = React.useRef<HTMLFormElement>(null)

  const handled = React.useRef<ActionState | null>(null)
  React.useEffect(() => {
    if (!state.ok || handled.current === state) return
    handled.current = state
    toast.success(state.message ?? 'Password updated.')
    formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-xl bg-chili-50 px-3.5 py-3 text-sm font-medium text-chili-700">
          {state.error}
        </p>
      ) : null}

      <Field
        label="Current password"
        htmlFor="currentPassword"
        required
        error={state.fieldErrors?.currentPassword?.[0]}
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          invalid={Boolean(state.fieldErrors?.currentPassword)}
        />
      </Field>

      <Field
        label="New password"
        htmlFor="newPassword"
        required
        hint="At least 10 characters."
        error={state.fieldErrors?.newPassword?.[0]}
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(state.fieldErrors?.newPassword)}
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        required
        error={state.fieldErrors?.confirmPassword?.[0]}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(state.fieldErrors?.confirmPassword)}
        />
      </Field>

      <SubmitButton />
    </form>
  )
}
