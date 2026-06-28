/**
 * Format a minor-unit integer amount into a human-readable currency string.
 *
 * Stripe amounts are integers in the smallest currency unit, and the number of
 * minor-unit digits varies per currency (USD = 2, JPY = 0). We derive the right
 * number of digits from `Intl.NumberFormat` so zero-decimal currencies are not
 * mis-divided by 100. Falls back to a raw "<amount> <CODE> (minor units)" string
 * for malformed currency codes.
 */
export function formatMoney(minor: number, currency: string): string {
  const code = currency.toUpperCase();
  try {
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: code });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(minor / 10 ** digits);
  } catch {
    // Thrown by Intl for malformed (non 3-letter) currency codes.
    return `${minor} ${code} (minor units)`;
  }
}
