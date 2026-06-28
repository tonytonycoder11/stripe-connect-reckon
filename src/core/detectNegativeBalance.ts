import type { BalanceSnapshot, Issue, ReconcileThresholds } from './types';
import { formatMoney } from './money';

/**
 * Resolve the per-currency threshold (in minor units) below which an available
 * balance is flagged. Precedence: per-currency override -> default -> 0.
 */
function resolveThreshold(currency: string, thresholds?: ReconcileThresholds): number {
  const nb = thresholds?.negativeBalance;
  const perCurrency = nb?.perCurrency?.[currency.toLowerCase()];
  if (typeof perCurrency === 'number') return perCurrency;
  return typeof nb?.defaultMinor === 'number' ? nb.defaultMinor : 0;
}

/**
 * NEGATIVE_BALANCE_RISK — flag connected accounts whose available balance is
 * negative (critical) or below a configured safety buffer (warning), per currency.
 *
 * Why per-currency: a Balance exposes one entry per currency, and they must never
 * be summed together. A negative `available` is the exact condition that suspends
 * payouts and can leave refunds stuck in `pending`.
 */
export function detectNegativeBalance(
  balances: BalanceSnapshot[],
  thresholds?: ReconcileThresholds,
): Issue[] {
  const issues: Issue[] = [];

  for (const snapshot of balances) {
    for (const entry of snapshot.available) {
      const threshold = resolveThreshold(entry.currency, thresholds);
      const isNegative = entry.amount < 0;
      const belowBuffer = entry.amount >= 0 && entry.amount < threshold;
      if (!isNegative && !belowBuffer) continue;

      // Look at incoming pending funds for the same currency — they may cover a
      // momentary negative once they become available (point-in-time nuance).
      const pendingForCurrency =
        snapshot.pending.find((p) => p.currency === entry.currency)?.amount ?? 0;
      const wouldPendingCover = isNegative && entry.amount + pendingForCurrency >= 0;
      const platformLiable = snapshot.lossesLiability === 'application';

      const severity: Issue['severity'] = isNegative ? 'critical' : 'warning';
      const formattedAmount = formatMoney(entry.amount, entry.currency);

      let message: string;
      if (isNegative) {
        message =
          `Available balance is ${formattedAmount} (negative) on connected account ` +
          `${snapshot.accountId}. While negative, Stripe suspends payouts for this ` +
          `account and refunds may be blocked.`;
        if (wouldPendingCover) {
          message +=
            ` Incoming pending funds (${formatMoney(pendingForCurrency, entry.currency)}) ` +
            `would cover it once available.`;
        }
        if (platformLiable) {
          message += ` The platform is liable for this negative balance.`;
        }
      } else {
        message =
          `Available balance ${formattedAmount} on connected account ${snapshot.accountId} ` +
          `is below the configured safety threshold of ${formatMoney(threshold, entry.currency)}.`;
      }

      issues.push({
        type: 'NEGATIVE_BALANCE_RISK',
        severity,
        accountId: snapshot.accountId,
        message,
        context: {
          currency: entry.currency,
          availableMinor: entry.amount,
          pendingMinor: pendingForCurrency,
          thresholdMinor: threshold,
          wouldPendingCover,
          lossesLiability: snapshot.lossesLiability ?? null,
        },
      });
    }
  }

  return issues;
}
