/**
 * Event types this library treats as financially relevant for EVENT_GAP.
 * Every type listed here was verified to exist in the Stripe events/types
 * reference during Phase 0 research.
 */
export const DEFAULT_RELEVANT_EVENT_TYPES: readonly string[] = [
  'payout.failed',
  'payout.canceled',
  'payout.updated',
  'charge.refunded',
  'charge.refund.updated',
  'refund.updated',
  'charge.dispute.created',
  'balance.available',
  'account.application.deauthorized',
];

/**
 * Relevant event types whose unprocessed presence is escalated to "critical"
 * (money did not move where it should have, or a dispute is open).
 */
export const CRITICAL_EVENT_TYPES: readonly string[] = [
  'payout.failed',
  'charge.dispute.created',
];
