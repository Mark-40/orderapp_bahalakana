'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { loginAction, type ActionState } from '@/server/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" block size="lg" loading={pending}>
      {pending ? 'Signing in' : 'Sign in'}
    </Button>
  )
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(loginAction, {})

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {/* Only same-origin relative paths are honoured, so `next` cannot be
          used as an open-redirect into another site. */}
      {next && next.startsWith('/') && !next.startsWith('//') ? (
        <input type="hidden" name="next" value={next} />
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-xl bg-chili-50 px-3.5 py-3 text-sm font-medium text-chili-700">
          {state.error}
        </p>
      ) : null}

      <Field label="Email" htmlFor="email" required error={state.fieldErrors?.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          enterKeyHint="next"
          autoFocus
          placeholder="admin@snackshop.test"
          invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <Field label="Password" htmlFor="password" required error={state.fieldErrors?.password?.[0]}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          enterKeyHint="go"
          placeholder="••••••••"
          invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <SubmitButton />
    </form>
  )
}
