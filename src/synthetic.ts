/**
 * Synthetic dataset for trying the engine without a real Stripe account.
 *
 * Exposed under the `stripe-connect-reckon/synthetic` subpath so demo/test helpers
 * stay out of the main import. The data is crafted to trigger all four issue types.
 */
import type {
  AppState,
  BalanceSnapshot,
  DetectionInput,
  PayoutRecord,
  RefundRecord,
  StripeEventRecord,
} from './core';
import type { ReconcileDataSource } from './dataSource';

/** Connected account ids used by the synthetic dataset. */
export const SYNTHETIC_ACCOUNTS = ['acct_healthy', 'acct_negative', 'acct_payouts'] as const;

const balances: BalanceSnapshot[] = [
  // Healthy: $1,250.00 available, no issue.
  {
    accountId: 'acct_healthy',
    available: [{ currency: 'usd', amount: 125_000 }],
    pending: [],
    livemode: false,
  },
  // Negative available: critical. Platform is liable; pending won't fully cover it.
  {
    accountId: 'acct_negative',
    available: [{ currency: 'usd', amount: -3_200 }],
    pending: [{ currency: 'usd', amount: 1_000 }],
    livemode: false,
    lossesLiability: 'application',
  },
];

const payouts: PayoutRecord[] = [
  {
    id: 'po_ok',
    accountId: 'acct_payouts',
    amount: 90_000,
    currency: 'usd',
    status: 'paid',
    created: 1_719_000_000,
  },
  {
    id: 'po_failed',
    accountId: 'acct_payouts',
    amount: 50_000,
    currency: 'usd',
    status: 'failed',
    failureCode: 'account_closed',
    failureMessage: 'The bank account has been closed.',
    created: 1_719_100_000,
  },
  {
    id: 'po_canceled',
    accountId: 'acct_payouts',
    amount: 12_000,
    currency: 'usd',
    status: 'canceled',
    created: 1_719_200_000,
  },
];

const refunds: RefundRecord[] = [
  {
    id: 're_known',
    accountId: 'acct_payouts',
    chargeId: 'ch_1',
    amount: 2_000,
    currency: 'usd',
    status: 'succeeded',
    created: 1_719_050_000,
  },
  // Not in the app's processed set => UNRECONCILED_REFUND.
  {
    id: 're_orphan',
    accountId: 'acct_payouts',
    paymentIntentId: 'pi_2',
    amount: 4_500,
    currency: 'usd',
    created: 1_719_060_000,
  },
];

const events: StripeEventRecord[] = [
  {
    id: 'evt_processed',
    type: 'charge.refunded',
    created: 1_719_050_000,
    accountId: 'acct_payouts',
  },
  // Relevant, before the cutoff, not processed => EVENT_GAP (critical: payout.failed).
  {
    id: 'evt_missed',
    type: 'payout.failed',
    created: 1_719_100_000,
    accountId: 'acct_payouts',
  },
];

const appState: AppState = {
  processedRefundIds: ['re_known'],
  processedEventIds: ['evt_processed'],
  lastProcessedEventAt: 1_719_300_000,
};

/** The app state that unlocks the refund- and event-reconciliation detectors. */
export function syntheticAppState(): AppState {
  return structuredClone(appState);
}

/**
 * A ready-made DetectionInput that triggers all four issue types, for trying the
 * engine without a Stripe account:
 *
 *   import { runDetectors } from 'stripe-connect-reckon';
 *   import { syntheticInput } from 'stripe-connect-reckon/synthetic';
 *   const issues = runDetectors(syntheticInput());
 */
export function syntheticInput(): DetectionInput {
  return {
    balances: structuredClone(balances),
    payouts: structuredClone(payouts),
    refunds: structuredClone(refunds),
    events: structuredClone(events),
    appState: structuredClone(appState),
  };
}

/**
 * A fake read-only data source returning the synthetic dataset, so the full
 * reconcile() flow can run offline:
 *
 *   import { reconcile } from 'stripe-connect-reckon';
 *   import { syntheticDataSource, syntheticAppState, SYNTHETIC_ACCOUNTS } from 'stripe-connect-reckon/synthetic';
 *   const report = await reconcile(
 *     { secretKey: 'sk_test_demo', accounts: [...SYNTHETIC_ACCOUNTS], knownState: syntheticAppState() },
 *     { dataSource: syntheticDataSource() },
 *   );
 */
export function syntheticDataSource(): ReconcileDataSource {
  return {
    async getBalances() {
      return structuredClone(balances);
    },
    async getPayouts() {
      return structuredClone(payouts);
    },
    async getRefunds() {
      return structuredClone(refunds);
    },
    async getEvents() {
      return structuredClone(events);
    },
  };
}
