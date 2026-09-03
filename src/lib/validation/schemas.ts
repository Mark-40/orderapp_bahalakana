import { z } from 'zod'

/**
 * Single source of truth for input shapes. These schemas run on the SERVER for
 * every mutation; the client reuses them only to give fast feedback. Nothing is
 * trusted because the client validated it.
 */

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const
export type OrderStatusValue = (typeof ORDER_STATUSES)[number]

export const FULFILLMENT_TYPES = ['PICKUP', 'DELIVERY'] as const

export const PAYMENT_METHODS = ['CASH', 'GCASH'] as const
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .max(200, 'That password is too long.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'The two passwords do not match.',
    path: ['confirmPassword'],
  })

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Category name must be at least 2 characters.')
    .max(50, 'Keep the name under 50 characters.'),
  description: z.string().trim().max(200, 'Keep the description under 200 characters.').optional().or(z.literal('')),
  sortOrder: z.coerce.number().int('Sort order must be a whole number.').min(0).max(999).default(0),
  isActive: z.boolean().default(true),
})
export type CategoryInput = z.infer<typeof categorySchema>

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

/** Accepts "120", "120.50", "₱120" and returns centavos. */
export const priceInPesos = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v : Number(String(v).replace(/[₱,\s]/g, ''))))
  .refine((v) => Number.isFinite(v), { message: 'Enter a valid price.' })
  .refine((v) => v >= 0, { message: 'Price cannot be negative.' })
  .refine((v) => v <= 1_000_000, { message: 'That price looks too large.' })
  .transform((v) => Math.round(v * 100))
  .refine((cents) => cents > 0, { message: 'Price must be greater than zero.' })

export const menuItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Item name must be at least 2 characters.')
    .max(80, 'Keep the name under 80 characters.'),
  description: z.string().trim().max(300, 'Keep the description under 300 characters.').optional().or(z.literal('')),
  categoryId: z.string().min(1, 'Choose a category.'),
  price: priceInPesos,
  imageUrl: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || v.startsWith('/') || /^https?:\/\//i.test(v), {
      message: 'Image must be an uploaded file or an http(s) URL.',
    }),
  isAvailable: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
})
export type MenuItemInput = z.infer<typeof menuItemSchema>

export const priceUpdateSchema = z.object({
  id: z.string().min(1),
  price: priceInPesos,
})

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

/** What the browser sends. Quantities only — never prices or totals. */
export const cartLineSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z
    .number()
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be at least 1.')
    .max(99, 'Maximum 99 of a single item.'),
})

export const checkoutSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, 'Please enter your name.')
    .max(80, 'Keep the name under 80 characters.'),
  notes: z.string().trim().max(500, 'Keep notes under 500 characters.').optional().or(z.literal('')),
  paymentMethod: z.enum(PAYMENT_METHODS).default('CASH'),
  /** Required when paymentMethod = GCASH; must be an uploaded /uploads/... URL. */
  paymentReceiptUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal('')),
  idempotencyKey: z.string().trim().min(8).max(100),
  items: z
    .array(cartLineSchema)
    .min(1, 'Your cart is empty.')
    .max(50, 'That is too many different items for one order.'),
})
  .refine(
    (v) => v.paymentMethod !== 'GCASH' || (v.paymentReceiptUrl ?? '').trim().length > 0,
    {
      message: 'Attach your GCash payment receipt.',
      path: ['paymentReceiptUrl'],
    },
  )
export type CheckoutInput = z.input<typeof checkoutSchema>

// ---------------------------------------------------------------------------
// Admin order management
// ---------------------------------------------------------------------------

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
})

export const orderFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
})
