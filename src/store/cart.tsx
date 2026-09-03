'use client'

import * as React from 'react'

/**
 * Client-side cart.
 *
 * It holds a price purely so the customer sees a running total while they
 * browse. That number is never authoritative: at checkout the server re-reads
 * every price from the database and recomputes the total (see
 * lib/orders/create-order.ts). The cart persists in localStorage so navigating
 * the menu — or reloading the tab — does not lose the order.
 */

const STORAGE_KEY = 'orderapp.cart.v1'
const MAX_QTY_PER_ITEM = 99

export type CartLine = {
  menuItemId: string
  name: string
  /** Price shown to the customer, in centavos. Advisory only. */
  price: number
  quantity: number
  imageUrl?: string | null
}

type CartState = {
  lines: CartLine[]
  /** True once localStorage has been read — guards against an SSR/CSR mismatch. */
  ready: boolean
}

type CartAction =
  | { type: 'hydrate'; lines: CartLine[] }
  | { type: 'add'; line: Omit<CartLine, 'quantity'>; quantity?: number }
  | { type: 'setQuantity'; menuItemId: string; quantity: number }
  | { type: 'remove'; menuItemId: string }
  | { type: 'clear' }
  | { type: 'reprice'; prices: Record<string, number> }
  | { type: 'removeMany'; menuItemIds: string[] }

const INITIAL_STATE: CartState = { lines: [], ready: false }

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'hydrate':
      // One action for the whole mount step: adopt the stored lines and mark
      // the cart ready, so hydration costs a single render rather than two.
      return { lines: action.lines, ready: true }

    case 'add': {
      const existing = state.lines.find((l) => l.menuItemId === action.line.menuItemId)
      const step = action.quantity ?? 1
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.menuItemId === action.line.menuItemId
              ? { ...l, ...action.line, quantity: clampQty(l.quantity + step) }
              : l,
          ),
        }
      }
      return { ...state, lines: [...state.lines, { ...action.line, quantity: clampQty(step) }] }
    }

    case 'setQuantity': {
      // Dropping to zero removes the line — quantities are never zero/negative.
      if (action.quantity < 1) {
        return { ...state, lines: state.lines.filter((l) => l.menuItemId !== action.menuItemId) }
      }
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.menuItemId === action.menuItemId ? { ...l, quantity: clampQty(action.quantity) } : l,
        ),
      }
    }

    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.menuItemId !== action.menuItemId) }

    case 'removeMany': {
      const drop = new Set(action.menuItemIds)
      return { ...state, lines: state.lines.filter((l) => !drop.has(l.menuItemId)) }
    }

    case 'reprice':
      return {
        ...state,
        lines: state.lines.map((l) =>
          typeof action.prices[l.menuItemId] === 'number'
            ? { ...l, price: action.prices[l.menuItemId]! }
            : l,
        ),
      }

    case 'clear':
      return { ...state, lines: [] }
  }
}

function clampQty(value: number): number {
  return Math.max(1, Math.min(MAX_QTY_PER_ITEM, Math.floor(value)))
}

type CartContextValue = {
  lines: CartLine[]
  /** True once localStorage has been read — guards against an SSR/CSR mismatch. */
  ready: boolean
  itemCount: number
  subtotal: number
  quantityOf: (menuItemId: string) => number
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void
  setQuantity: (menuItemId: string, quantity: number) => void
  remove: (menuItemId: string) => void
  removeMany: (menuItemIds: string[]) => void
  reprice: (prices: Record<string, number>) => void
  clear: () => void
}

const CartContext = React.createContext<CartContextValue | null>(null)

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false
  const line = value as Record<string, unknown>
  return (
    typeof line.menuItemId === 'string' &&
    typeof line.name === 'string' &&
    typeof line.price === 'number' &&
    typeof line.quantity === 'number' &&
    line.quantity > 0
  )
}

function readStoredLines(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : []
  } catch {
    // Corrupt or unavailable storage (private mode) — start with an empty cart.
    return []
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, INITIAL_STATE)

  // localStorage does not exist during SSR, so the stored cart can only be read
  // after mount. This is the one legitimate render-cascade in the app: the
  // first paint must match the server HTML, and the stored cart arrives after.
  React.useEffect(() => {
    dispatch({ type: 'hydrate', lines: readStoredLines() })
  }, [])

  React.useEffect(() => {
    // Skip the pre-hydration render, which would overwrite storage with [].
    if (!state.ready) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lines))
    } catch {
      // Quota or private mode: the cart still works for this session.
    }
  }, [state.lines, state.ready])

  const value = React.useMemo<CartContextValue>(() => {
    const itemCount = state.lines.reduce((sum, l) => sum + l.quantity, 0)
    const subtotal = state.lines.reduce((sum, l) => sum + l.price * l.quantity, 0)
    return {
      lines: state.lines,
      ready: state.ready,
      itemCount,
      subtotal,
      quantityOf: (menuItemId) =>
        state.lines.find((l) => l.menuItemId === menuItemId)?.quantity ?? 0,
      add: (line, quantity) => dispatch({ type: 'add', line, quantity }),
      setQuantity: (menuItemId, quantity) => dispatch({ type: 'setQuantity', menuItemId, quantity }),
      remove: (menuItemId) => dispatch({ type: 'remove', menuItemId }),
      removeMany: (menuItemIds) => dispatch({ type: 'removeMany', menuItemIds }),
      reprice: (prices) => dispatch({ type: 'reprice', prices }),
      clear: () => dispatch({ type: 'clear' }),
    }
  }, [state.lines, state.ready])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const context = React.useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside <CartProvider>.')
  return context
}
