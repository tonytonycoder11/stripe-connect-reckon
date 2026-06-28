import Stripe from 'stripe';

/**
 * API version that stripe-node v22.3.0 pins. We set it explicitly so the version
 * sent on the wire matches the one the installed TypeScript types were generated
 * against (verified from the SDK source during Phase 0 research).
 */
export const DEFAULT_API_VERSION = '2026-06-24.dahlia';

/**
 * Construct a Stripe client for READ-ONLY use. The adapter built on top of this
 * client only ever calls list/retrieve endpoints — nothing here writes to Stripe.
 */
export function createStripeClient(
  secretKey: string,
  apiVersion: string = DEFAULT_API_VERSION,
): Stripe {
  return new Stripe(secretKey, {
    // StripeConfig pins apiVersion to the exact literal the installed SDK types
    // were generated against. We allow a string override but assert it to that
    // literal type (kept in sync with DEFAULT_API_VERSION). Overriding to a
    // different version is possible but may desync runtime shapes from the types.
    apiVersion: apiVersion as typeof DEFAULT_API_VERSION,
    typescript: true,
  });
}
