/**
 * Synthetic fixtures for the pure-core tests. No real Stripe data, no network.
 * All amounts are in minor units; timestamps are arbitrary Unix seconds.
 */
import type {
  AppState,
  BalanceSnapshot,
  PayoutRecord,
  RefundRecord,
  StripeEventRecord,
} from '../../../src/core';

export const balances = {
  /** Negative USD available, with some incoming pending that would cover it. */
  negativeUsd: {
    accountId: 'acct_neg',
    available: [{ currency: 'usd', amount: -1500 }],
    pending: [{ currency: 'usd', amount: 500 }],
  } satisfies BalanceSnapshot,

  /** Healthy account — should never produce an issue. */
  healthy: {
    accountId: 'acct_ok',
    available: [{ currency: 'usd', amount: 250000 }],
    pending: [],
  } satisfies BalanceSnapshot,

  /** Positive but below a configured buffer (warning only). */
  belowBuffer: {
    accountId: 'acct_low',
    available: [{ currency: 'eur', amount: 300 }],
    pending: [],
  } satisfies BalanceSnapshot,

  /** Negative balance where the PLATFORM is liable (message escalation). */
  platformLiable: {
    accountId: 'acct_plat',
    available: [{ currency: 'usd', amount: -2000 }],
    pending: [],
    lossesLiability: 'application',
  } satisfies BalanceSnapshot,

  /** Multiple currencies: usd negative, eur healthy, jpy negative (zero-decimal). */
  multiCurrency: {
    accountId: 'acct_multi',
    available: [
      { currency: 'usd', amount: -100 },
      { currency: 'eur', amount: 5000 },
      { currency: 'jpy', amount: -50 },
    ],
    pending: [{ currency: 'usd', amount: 1000 }],
  } satisfies BalanceSnapshot,
} as const;

export const payouts = {
  failed: {
    id: 'po_failed',
    accountId: 'acct_a',
    amount: 10000,
    currency: 'usd',
    status: 'failed',
    failureCode: 'insufficient_funds',
    failureMessage: 'Insufficient funds in the bank account.',
    created: 1000,
    automatic: true,
  } satisfies PayoutRecord,

  failedNoReason: {
    id: 'po_failed_bare',
    accountId: 'acct_a',
    amount: 4200,
    currency: 'usd',
    status: 'failed',
    failureCode: null,
    failureMessage: null,
    created: 1100,
  } satisfies PayoutRecord,

  canceled: {
    id: 'po_canceled',
    accountId: 'acct_b',
    amount: 7000,
    currency: 'eur',
    status: 'canceled',
    created: 1200,
  } satisfies PayoutRecord,

  paid: {
    id: 'po_paid',
    accountId: 'acct_b',
    amount: 9000,
    currency: 'usd',
    status: 'paid',
    created: 1300,
  } satisfies PayoutRecord,
} as const;

export const refunds = {
  reconciled: {
    id: 're_known',
    accountId: 'acct_a',
    chargeId: 'ch_1',
    amount: 1000,
    currency: 'usd',
    status: 'succeeded',
    created: 2000,
  } satisfies RefundRecord,

  unreconciled: {
    id: 're_unknown',
    accountId: 'acct_a',
    paymentIntentId: 'pi_2',
    amount: 2500,
    currency: 'usd',
    created: 2100,
  } satisfies RefundRecord,
} as const;

export const events = {
  payoutFailed: {
    id: 'evt_pf',
    type: 'payout.failed',
    created: 1000,
    accountId: 'acct_a',
  } satisfies StripeEventRecord,

  chargeRefunded: {
    id: 'evt_cr',
    type: 'charge.refunded',
    created: 1100,
    accountId: 'acct_a',
  } satisfies StripeEventRecord,

  irrelevant: {
    id: 'evt_irrelevant',
    type: 'customer.created',
    created: 1200,
    accountId: 'acct_a',
  } satisfies StripeEventRecord,

  /** Newer than the "caught up" cutoff — expected backlog, not a gap. */
  futureRefund: {
    id: 'evt_future',
    type: 'refund.updated',
    created: 5000,
    accountId: 'acct_a',
  } satisfies StripeEventRecord,

  /** Platform-scoped event (no originating connected account). */
  platformBalance: {
    id: 'evt_balance',
    type: 'balance.available',
    created: 1300,
    accountId: null,
  } satisfies StripeEventRecord,
} as const;

export const appState: AppState = {
  processedRefundIds: ['re_known'],
  processedEventIds: ['evt_cr'],
  lastProcessedEventAt: 2000,
};
