import { CartProvider } from '@/store/cart'

/**
 * Wraps every customer-facing route in one CartProvider, so the cart survives
 * navigation between the menu, checkout and confirmation.
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>
}
