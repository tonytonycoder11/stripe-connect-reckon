import type { Issue, PayoutRecord } from './types';
import { formatMoney } from './money';

/**
 * FAILED_PAYOUT — flag payouts in a `failed` (critical) or `canceled` (warning)
 * state on a connected account.
 *
 * Note from Phase 0 research: `failure_code` / `failure_message` are populated
 * only "if available" and can be null even on a failed payout, so the message
 * degrades gracefully when they are missing. A single snapshot can also be stale
 * (a payout may briefly show `paid` then flip to `failed`); Phase 2 will combine
 * this with the `payout.failed` event for robustness.
 */
export function detectFailedPayouts(payouts: PayoutRecord[]): Issue[] {
  const issues: Issue[] = [];

  for (const payout of payouts) {
    if (payout.status !== 'failed' && payout.status !== 'canceled') continue;

    const severity: Issue['severity'] = payout.status === 'failed' ? 'critical' : 'warning';
    const amount = formatMoney(payout.amount, payout.currency);

    let message: string;
    if (payout.status === 'failed') {
      const code = payout.failureCode ? ` (${payout.failureCode})` : '';
      const reason = payout.failureMessage ? `: ${payout.failureMessage}` : '';
      message =
        `Payout ${payout.id} of ${amount} on connected account ${payout.accountId} ` +
        `FAILED${code}${reason}. The funds did not reach the bank account.`;
    } else {
      message =
        `Payout ${payout.id} of ${amount} on connected account ${payout.accountId} was canceled.`;
    }

    issues.push({
      type: 'FAILED_PAYOUT',
      severity,
      accountId: payout.accountId,
      message,
      context: {
        payoutId: payout.id,
        status: payout.status,
        failureCode: payout.failureCode ?? null,
        failureMessage: payout.failureMessage ?? null,
        amountMinor: payout.amount,
        currency: payout.currency,
        arrivalDate: payout.arrivalDate ?? null,
        automatic: payout.automatic ?? null,
      },
    });
  }

  return issues;
}
