import type {
  BalanceSnapshot,
  PayoutRecord,
  RefundRecord,
  StripeEventRecord,
} from './core';

/** Inclusive time window, expressed in Unix seconds. */
export interface TimeWindow {
  since?: number;
  until?: number;
}

/**
 * Port the reconcile use-case depends on (clean architecture: defined by the
 * application layer, implemented by infrastructure). Every method is read-only.
 *
 * The default implementation is the read-only Stripe adapter; tests inject a fake
 * so the use-case can be exercised without any network access.
 */
export interface ReconcileDataSource {
  /** Current balance of each connected account. */
  getBalances(accountIds: string[]): Promise<BalanceSnapshot[]>;
  /** Payouts of each connected account within the window. */
  getPayouts(accountIds: string[], window: TimeWindow): Promise<PayoutRecord[]>;
  /** Relevant platform-level events within the window. */
  getEvents(window: TimeWindow, relevantTypes: string[]): Promise<StripeEventRecord[]>;
  /** Refunds of each connected account within the window. */
  getRefunds(accountIds: string[], window: TimeWindow): Promise<RefundRecord[]>;
}
