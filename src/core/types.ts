/**
 * Domain types for stripe-connect-reckon (Phase 1, pure core).
 *
 * These types are deliberately DECOUPLED from the stripe-node SDK objects: the
 * core knows nothing about Stripe or any I/O. The stripe/ adapter (Phase 2) maps
 * raw SDK responses into these plain DTOs before handing them to the detectors.
 * This is what keeps the core unit-testable with fixtures and free of network.
 */

/** Severity of a detected issue, from least to most urgent. */
export type Severity = 'info' | 'warning' | 'critical';

/** The kinds of issue the v0 engine can report. */
export type IssueType =
  | 'NEGATIVE_BALANCE_RISK'
  | 'FAILED_PAYOUT'
  | 'UNRECONCILED_REFUND'
  | 'EVENT_GAP';

/** Lifecycle status of a Stripe payout (mirrors the Payout.status enum). */
export type PayoutStatus = 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed';

/**
 * Who is responsible for covering losses / negative balances on an account.
 * Read from `controller.losses.payments` (Accounts v1) or
 * `defaults.responsibilities.losses_collector` (Accounts v2).
 */
export type LossesLiability = 'stripe' | 'application';

/**
 * A single per-currency money amount, in the smallest currency unit
 * (e.g. cents for USD). Mirrors a Balance "available"/"pending" array entry.
 */
export interface MoneyAmount {
  /** Three-letter ISO currency code, lowercase (e.g. "usd"). */
  currency: string;
  /** Amount in the smallest currency unit. May be negative. */
  amount: number;
}

/**
 * Point-in-time balance snapshot for one connected account.
 * Maps from `stripe.balance.retrieve({}, { stripeAccount })`.
 */
export interface BalanceSnapshot {
  /** Connected account id (acct_...). */
  accountId: string;
  /** Funds available to pay out now, per currency. */
  available: MoneyAmount[];
  /** Funds not yet available, per currency. */
  pending: MoneyAmount[];
  /** Whether the data is live-mode (false in test mode). */
  livemode?: boolean;
  /**
   * Optional liability context. When "application", the PLATFORM bears the
   * negative balance — this raises the stakes of a negative-balance issue.
   */
  lossesLiability?: LossesLiability;
  /** Optional: whether Stripe may debit the external account on negative balance. */
  debitNegativeBalances?: boolean;
}

/** A payout record for one connected account. Maps from the Payout object. */
export interface PayoutRecord {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  /** Failure reason code, populated only "if available" (may be null even on failure). */
  failureCode?: string | null;
  /** Human-readable failure reason, populated only "if available". */
  failureMessage?: string | null;
  /** Expected arrival timestamp (Unix seconds). */
  arrivalDate?: number | null;
  /** true if created by an automatic payout schedule. */
  automatic?: boolean;
  /** Creation timestamp (Unix seconds). */
  created: number;
}

/** A refund observed on Stripe. Maps from the Refund object. */
export interface RefundRecord {
  id: string;
  /** Connected account the refund belongs to (acct_...) or "platform". */
  accountId: string;
  chargeId?: string | null;
  paymentIntentId?: string | null;
  amount: number;
  currency: string;
  status?: string;
  created: number;
}

/** A Stripe event, reduced to the fields the gap detector needs. */
export interface StripeEventRecord {
  id: string;
  /** Event type, e.g. "payout.failed". */
  type: string;
  /** Creation timestamp (Unix seconds). */
  created: number;
  /** Connected account that originated the event (Event.account), if any. */
  accountId?: string | null;
}

/**
 * The state the consuming application believes it has. Optional: when omitted,
 * the refund- and event-reconciliation detectors stay silent — they cannot infer
 * "what the app missed" without a reference point.
 */
export interface AppState {
  /** Ids of refunds the app has already processed. Enables UNRECONCILED_REFUND. */
  processedRefundIds?: string[];
  /** Ids of events the app has already processed. Enables EVENT_GAP. */
  processedEventIds?: string[];
  /**
   * Optional "caught up to" timestamp (Unix seconds). When set, events created
   * AFTER this point are treated as expected backlog rather than gaps.
   */
  lastProcessedEventAt?: number;
}

/** Per-currency negative-balance thresholds (in minor units). */
export interface NegativeBalanceThresholds {
  /** Default threshold below which "available" is flagged. Defaults to 0. */
  defaultMinor?: number;
  /** Per-currency overrides, keyed by lowercase ISO code. */
  perCurrency?: Record<string, number>;
}

/** Tunable detection thresholds. */
export interface ReconcileThresholds {
  negativeBalance?: NegativeBalanceThresholds;
}

/** A detected issue — the unit of output of the whole engine. */
export interface Issue {
  type: IssueType;
  severity: Severity;
  /** Connected account id, or "platform" for platform-scoped issues. */
  accountId: string;
  /** Human-readable, self-contained description. */
  message: string;
  /** Structured raw fields that triggered the issue (for programmatic use). */
  context: Record<string, unknown>;
}

/** Everything the pure detectors need to run. No I/O, no Stripe types. */
export interface DetectionInput {
  balances?: BalanceSnapshot[];
  payouts?: PayoutRecord[];
  refunds?: RefundRecord[];
  events?: StripeEventRecord[];
  appState?: AppState;
  thresholds?: ReconcileThresholds;
  /** Override the set of event types considered "relevant" for EVENT_GAP. */
  relevantEventTypes?: string[];
}
