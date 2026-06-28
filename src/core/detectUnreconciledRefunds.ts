import type { AppState, Issue, RefundRecord } from './types';
import { formatMoney } from './money';

/**
 * UNRECONCILED_REFUND — flag refunds that exist on Stripe but are absent from the
 * application's own processed-refund state.
 *
 * This detector is intentionally silent unless the app supplies
 * `appState.processedRefundIds`. Without that reference set there is no honest way
 * to know what the app "missed" — so we emit nothing rather than guess.
 */
export function detectUnreconciledRefunds(
  refunds: RefundRecord[],
  appState?: AppState,
): Issue[] {
  if (!appState || appState.processedRefundIds === undefined) return [];

  const processed = new Set(appState.processedRefundIds);
  const issues: Issue[] = [];

  for (const refund of refunds) {
    if (processed.has(refund.id)) continue;

    issues.push({
      type: 'UNRECONCILED_REFUND',
      severity: 'warning',
      accountId: refund.accountId,
      message:
        `Refund ${refund.id} (${formatMoney(refund.amount, refund.currency)}) exists on ` +
        `Stripe but is not in the application's processed-refunds state for connected ` +
        `account ${refund.accountId}.`,
      context: {
        refundId: refund.id,
        chargeId: refund.chargeId ?? null,
        paymentIntentId: refund.paymentIntentId ?? null,
        amountMinor: refund.amount,
        currency: refund.currency,
        status: refund.status ?? null,
      },
    });
  }

  return issues;
}
