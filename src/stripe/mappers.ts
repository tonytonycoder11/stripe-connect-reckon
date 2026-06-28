import type Stripe from 'stripe';
import type {
  BalanceSnapshot,
  MoneyAmount,
  PayoutRecord,
  PayoutStatus,
  RefundRecord,
  StripeEventRecord,
} from '../core';

/**
 * Pure mappers from Stripe SDK objects to the core's plain DTOs. They are typed
 * with `Pick<Stripe.X, ...>` so they stay tied to the SDK shape (a renamed field
 * breaks compilation) while remaining trivial to construct in tests. Keeping the
 * mapping here is what lets the core stay free of any Stripe import.
 */

type BalanceLike = Pick<Stripe.Balance, 'available' | 'pending' | 'livemode'>;
type PayoutLike = Pick<
  Stripe.Payout,
  | 'id'
  | 'amount'
  | 'currency'
  | 'status'
  | 'failure_code'
  | 'failure_message'
  | 'arrival_date'
  | 'automatic'
  | 'created'
>;
type EventLike = Pick<Stripe.Event, 'id' | 'type' | 'created' | 'account'>;
type RefundLike = Pick<
  Stripe.Refund,
  'id' | 'amount' | 'currency' | 'status' | 'charge' | 'payment_intent' | 'created'
>;

function toMoney(entries: Array<{ amount: number; currency: string }>): MoneyAmount[] {
  return entries.map((entry) => ({ currency: entry.currency, amount: entry.amount }));
}

/** Resolve an expandable reference (string id or expanded object) to its id. */
function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && 'id' in ref) return ref.id;
  return null;
}

export function mapBalance(balance: BalanceLike, accountId: string): BalanceSnapshot {
  return {
    accountId,
    available: toMoney(balance.available),
    pending: toMoney(balance.pending),
    livemode: balance.livemode,
  };
}

export function mapPayout(payout: PayoutLike, accountId: string): PayoutRecord {
  return {
    id: payout.id,
    accountId,
    amount: payout.amount,
    currency: payout.currency,
    status: payout.status as PayoutStatus,
    failureCode: payout.failure_code,
    failureMessage: payout.failure_message,
    arrivalDate: payout.arrival_date,
    automatic: payout.automatic,
    created: payout.created,
  };
}

export function mapRefund(refund: RefundLike, accountId: string): RefundRecord {
  return {
    id: refund.id,
    accountId,
    chargeId: idOf(refund.charge),
    paymentIntentId: idOf(refund.payment_intent),
    amount: refund.amount,
    currency: refund.currency,
    status: refund.status ?? undefined,
    created: refund.created,
  };
}

export function mapEvent(event: EventLike): StripeEventRecord {
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    accountId: event.account ?? null,
  };
}
