import type Stripe from 'stripe';
import type { PayoutRecord, RefundRecord, BalanceSnapshot } from '../core';
import type { ReconcileDataSource, TimeWindow } from '../dataSource';
import { mapBalance, mapEvent, mapPayout, mapRefund } from './mappers';

export interface StripeDataSourceOptions {
  /** Hard cap on items fetched per list call (pagination safety). Default 1000. */
  maxItemsPerList?: number;
}

const DEFAULT_MAX_ITEMS = 1000;

/** Build a Stripe `created` range filter from a time window, or undefined. */
function toCreatedFilter(window: TimeWindow): Stripe.RangeQueryParam | undefined {
  if (window.since === undefined && window.until === undefined) return undefined;
  const filter: Stripe.RangeQueryParam = {};
  if (window.since !== undefined) filter.gte = window.since;
  if (window.until !== undefined) filter.lte = window.until;
  return filter;
}

/**
 * Read-only Stripe-backed implementation of {@link ReconcileDataSource}.
 *
 * It only calls list/retrieve endpoints and never writes to Stripe. Balances,
 * payouts and refunds are fetched per connected account via the `Stripe-Account`
 * header (the `stripeAccount` request option); events are read at the platform
 * level and carry an `account` attribute identifying the originating connected
 * account. Lists are auto-paginated up to `maxItemsPerList`.
 *
 * Accounts are queried sequentially to stay gentle on rate limits. Large
 * platforms that need parallelism with throttling can wrap this source.
 */
export function createStripeDataSource(
  stripe: Stripe,
  options: StripeDataSourceOptions = {},
): ReconcileDataSource {
  const maxItems = options.maxItemsPerList ?? DEFAULT_MAX_ITEMS;

  return {
    async getBalances(accountIds) {
      const balances: BalanceSnapshot[] = [];
      for (const accountId of accountIds) {
        const balance = await stripe.balance.retrieve({}, { stripeAccount: accountId });
        balances.push(mapBalance(balance, accountId));
      }
      return balances;
    },

    async getPayouts(accountIds, window) {
      const created = toCreatedFilter(window);
      const payouts: PayoutRecord[] = [];
      for (const accountId of accountIds) {
        const page = await stripe.payouts
          .list({ limit: 100, ...(created ? { created } : {}) }, { stripeAccount: accountId })
          .autoPagingToArray({ limit: maxItems });
        for (const payout of page) payouts.push(mapPayout(payout, accountId));
      }
      return payouts;
    },

    async getEvents(window, relevantTypes) {
      const created = toCreatedFilter(window);
      const page = await stripe.events
        .list({ limit: 100, types: [...relevantTypes], ...(created ? { created } : {}) })
        .autoPagingToArray({ limit: maxItems });
      return page.map(mapEvent);
    },

    async getRefunds(accountIds, window) {
      const created = toCreatedFilter(window);
      const refunds: RefundRecord[] = [];
      for (const accountId of accountIds) {
        const page = await stripe.refunds
          .list({ limit: 100, ...(created ? { created } : {}) }, { stripeAccount: accountId })
          .autoPagingToArray({ limit: maxItems });
        for (const refund of page) refunds.push(mapRefund(refund, accountId));
      }
      return refunds;
    },
  };
}
