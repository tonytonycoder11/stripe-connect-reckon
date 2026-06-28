/**
 * Public surface of the pure detection core.
 * No I/O lives in this layer — only domain types and deterministic detectors.
 */
export type {
  Severity,
  IssueType,
  PayoutStatus,
  LossesLiability,
  MoneyAmount,
  BalanceSnapshot,
  PayoutRecord,
  RefundRecord,
  StripeEventRecord,
  AppState,
  NegativeBalanceThresholds,
  ReconcileThresholds,
  Issue,
  DetectionInput,
} from './types';

export { DEFAULT_RELEVANT_EVENT_TYPES, CRITICAL_EVENT_TYPES } from './constants';
export { formatMoney } from './money';
export { detectNegativeBalance } from './detectNegativeBalance';
export { detectFailedPayouts } from './detectFailedPayouts';
export { detectUnreconciledRefunds } from './detectUnreconciledRefunds';
export { detectEventGaps } from './detectEventGaps';
export { runDetectors } from './runDetectors';
