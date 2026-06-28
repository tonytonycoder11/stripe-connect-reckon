/**
 * stripe-connect-reckon — public entry point.
 *
 * - Pure detection core: domain types + detectors + `runDetectors`.
 * - Read-only Stripe adapter + `reconcile(config)`: fetches live data (test mode)
 *   and feeds the core.
 */

// Pure detection core.
export * from './core';

// Reconciliation use-case (read-only).
export { reconcile, runReconcile } from './reconcile';
export type { ReconcileConfig, ReconcileDeps } from './reconcile';

// Data-source port (implemented by the Stripe adapter or by a fake in tests).
export type { ReconcileDataSource, TimeWindow } from './dataSource';

// Structured report.
export { buildReport } from './report/buildReport';
export type { ReportMeta } from './report/buildReport';
export type { Report, ReportSummary } from './report/types';

// Read-only Stripe adapter.
export { createStripeClient, DEFAULT_API_VERSION } from './stripe/client';
export { createStripeDataSource } from './stripe/stripeDataSource';
export type { StripeDataSourceOptions } from './stripe/stripeDataSource';
export { mapBalance, mapEvent, mapPayout, mapRefund } from './stripe/mappers';
