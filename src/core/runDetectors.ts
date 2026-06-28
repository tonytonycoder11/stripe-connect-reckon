import type { DetectionInput, Issue, Severity } from './types';
import { detectNegativeBalance } from './detectNegativeBalance';
import { detectFailedPayouts } from './detectFailedPayouts';
import { detectUnreconciledRefunds } from './detectUnreconciledRefunds';
import { detectEventGaps } from './detectEventGaps';

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** Stable ordering: most severe first, then by type, then by account. */
function compareIssues(a: Issue, b: Issue): number {
  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (bySeverity !== 0) return bySeverity;
  if (a.type !== b.type) return a.type < b.type ? -1 : 1;
  if (a.accountId !== b.accountId) return a.accountId < b.accountId ? -1 : 1;
  return 0;
}

/**
 * Run every detector over the given input and return a stably-sorted issue list.
 *
 * This is the pure heart of the library: no I/O, no Stripe SDK, fully
 * deterministic and unit-testable with fixtures. The networked reconcile(config)
 * entry point (Phase 2) will gather data via the read-only Stripe adapter and
 * delegate here.
 */
export function runDetectors(input: DetectionInput): Issue[] {
  const issues: Issue[] = [
    ...detectNegativeBalance(input.balances ?? [], input.thresholds),
    ...detectFailedPayouts(input.payouts ?? []),
    ...detectUnreconciledRefunds(input.refunds ?? [], input.appState),
    ...detectEventGaps(input.events ?? [], input.appState, input.relevantEventTypes),
  ];
  return issues.sort(compareIssues);
}
