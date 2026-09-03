/**
 * Money helpers. Every amount inside the app is an integer number of centavos;
 * pesos only exist at the UI edge. Never introduce floating point arithmetic
 * into a total — convert, compute in integers, then format.
 */

export const CURRENCY_SYMBOL = '₱'

/** 120.5 (pesos) -> 12050 (centavos). Rounds to the nearest centavo. */
export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * 100)
}

/** 12050 (centavos) -> 120.5 (pesos). For form inputs only, never for math. */
export function centavosToPesos(centavos: number): number {
  return centavos / 100
}

/** 12050 -> "₱120.50" */
export function formatMoney(centavos: number): string {
  const sign = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  const formatted = (abs / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${sign}${CURRENCY_SYMBOL}${formatted}`
}

/** 12000 -> "₱120" but 12050 -> "₱120.50". Compact display for menu cards. */
export function formatMoneyCompact(centavos: number): string {
  return centavos % 100 === 0
    ? `${CURRENCY_SYMBOL}${Math.round(centavos / 100).toLocaleString('en-PH')}`
    : formatMoney(centavos)
}
