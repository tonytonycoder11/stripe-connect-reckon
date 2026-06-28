import { DEFAULT_RELEVANT_EVENT_TYPES, runDetectors } from './core';
import type { AppState, ReconcileThresholds } from './core';
import type { ReconcileDataSource, TimeWindow } from './dataSource';
import { buildReport } from './report/buildReport';
import type { Report } from './report/types';
import { createStripeClient } from './stripe/client';
import { createStripeDataSource } from './stripe/stripeDataSource';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

export interface ReconcileConfig {
  /** Stripe secret key. Use a TEST-mode key (sk_test_...) in v0. Read-only usage. */
  secretKey: string;
  /** Connected accounts to inspect (acct_...). */
  accounts: string[];
  /** Pinned Stripe API version. Defaults to the version stripe-node v22 ships. */
  apiVersion?: string;
  /** Detection thresholds (per-currency negative buffers, etc.). */
  thresholds?: ReconcileThresholds;
  /** Optional state the app believes it has — enables UNRECONCILED_REFUND / EVENT_GAP. */
  knownState?: AppState;
  /** Time window for payout/event/refund lookups. Defaults to the last 30 days. */
  window?: { since?: Date; until?: Date };
  /** Hard cap on items fetched per list call (pagination safety). */
  maxItemsPerList?: number;
  /** Override which event types count as relevant for EVENT_GAP. */
  relevantEventTypes?: string[];
}

/** Injectable dependencies — tests pass a fake data source to avoid the network. */
export interface ReconcileDeps {
  dataSource?: ReconcileDataSource;
  now?: Date;
}

function resolveWindow(window: ReconcileConfig['window'], now: Date): TimeWindow {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const since = window?.since
    ? Math.floor(window.since.getTime() / 1000)
    : nowSeconds - THIRTY_DAYS_SECONDS;
  const until = window?.until ? Math.floor(window.until.getTime() / 1000) : undefined;
  return until === undefined ? { since } : { since, until };
}

function isLiveKey(secretKey: string): boolean {
  return secretKey.startsWith('sk_live') || secretKey.startsWith('rk_live');
}

/**
 * Pure orchestration: pull data through the given data source, run the detectors,
 * and assemble a Report. Split out from {@link reconcile} so it can be unit-tested
 * with a fake data source and no network.
 *
 * Refunds and events are fetched only when the app supplies the state those
 * detectors compare against — there is nothing to reconcile them against otherwise.
 */
export async function runReconcile(
  dataSource: ReconcileDataSource,
  config: ReconcileConfig,
  now: Date,
): Promise<Report> {
  const window = resolveWindow(config.window, now);
  const accounts = config.accounts;
  const relevantTypes = config.relevantEventTypes ?? [...DEFAULT_RELEVANT_EVENT_TYPES];

  const wantRefunds = config.knownState?.processedRefundIds !== undefined;
  const wantEvents = config.knownState?.processedEventIds !== undefined;

  const balances = await dataSource.getBalances(accounts);
  const payouts = await dataSource.getPayouts(accounts, window);
  const refunds = wantRefunds ? await dataSource.getRefunds(accounts, window) : [];
  const events = wantEvents ? await dataSource.getEvents(window, relevantTypes) : [];

  const issues = runDetectors({
    balances,
    payouts,
    refunds,
    events,
    appState: config.knownState,
    thresholds: config.thresholds,
    relevantEventTypes: config.relevantEventTypes,
  });

  const livemode =
    balances.length > 0 ? balances.some((b) => b.livemode === true) : isLiveKey(config.secretKey);

  return buildReport(issues, {
    generatedAt: now.toISOString(),
    livemode,
    accountsChecked: accounts,
  });
}

/**
 * Read-only entry point. Connects to Stripe, gathers balances and payouts (and,
 * when app state is supplied, refunds and events), runs detection, and returns a
 * structured Report.
 *
 * Pass `deps.dataSource` to inject a fake source in tests; otherwise a read-only
 * Stripe-backed source is built from `config.secretKey`.
 */
export async function reconcile(
  config: ReconcileConfig,
  deps: ReconcileDeps = {},
): Promise<Report> {
  const now = deps.now ?? new Date();
  const dataSource =
    deps.dataSource ??
    createStripeDataSource(createStripeClient(config.secretKey, config.apiVersion), {
      maxItemsPerList: config.maxItemsPerList,
    });
  return runReconcile(dataSource, config, now);
}
