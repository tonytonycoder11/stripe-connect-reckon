import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { createStripeDataSource } from '../../src/stripe/stripeDataSource';

/**
 * Minimal stub of the Stripe client exposing only the read methods the adapter
 * uses. `autoPagingToArray` is faked to return the synthetic page. No network.
 */
function fakeStripe() {
  const calls = {
    balanceAccounts: [] as string[],
    payoutAccounts: [] as string[],
    refundAccounts: [] as string[],
    eventParams: undefined as unknown,
  };
  const page = (items: unknown[]) => ({
    autoPagingToArray: async (_opts: { limit: number }) => items,
  });

  const stub = {
    balance: {
      retrieve: async (_params: unknown, opts: { stripeAccount: string }) => {
        calls.balanceAccounts.push(opts.stripeAccount);
        return { available: [{ amount: -100, currency: 'usd' }], pending: [], livemode: false };
      },
    },
    payouts: {
      list: (_params: unknown, opts: { stripeAccount: string }) => {
        calls.payoutAccounts.push(opts.stripeAccount);
        return page([
          {
            id: 'po_1',
            amount: 1000,
            currency: 'usd',
            status: 'failed',
            failure_code: null,
            failure_message: null,
            arrival_date: 1,
            automatic: true,
            created: 1,
          },
        ]);
      },
    },
    events: {
      list: (params: unknown) => {
        calls.eventParams = params;
        return page([{ id: 'evt_1', type: 'payout.failed', created: 2, account: 'acct_1' }]);
      },
    },
    refunds: {
      list: (_params: unknown, opts: { stripeAccount: string }) => {
        calls.refundAccounts.push(opts.stripeAccount);
        return page([
          { id: 're_1', amount: 500, currency: 'usd', status: 'succeeded', charge: 'ch_1', payment_intent: null, created: 3 },
        ]);
      },
    },
  };

  return { stripe: stub as unknown as Stripe, calls };
}

describe('createStripeDataSource (read-only adapter)', () => {
  it('reads each connected account balance via the Stripe-Account option', async () => {
    const { stripe, calls } = fakeStripe();
    const ds = createStripeDataSource(stripe, { maxItemsPerList: 50 });

    const balances = await ds.getBalances(['acct_1', 'acct_2']);

    expect(calls.balanceAccounts).toEqual(['acct_1', 'acct_2']);
    expect(balances[0]?.available).toEqual([{ currency: 'usd', amount: -100 }]);
  });

  it('lists payouts per account and maps them', async () => {
    const { stripe, calls } = fakeStripe();
    const ds = createStripeDataSource(stripe);

    const payouts = await ds.getPayouts(['acct_1'], { since: 100 });

    expect(calls.payoutAccounts).toEqual(['acct_1']);
    expect(payouts[0]?.status).toBe('failed');
    expect(payouts[0]?.accountId).toBe('acct_1');
  });

  it('lists platform events filtered by relevant types', async () => {
    const { stripe, calls } = fakeStripe();
    const ds = createStripeDataSource(stripe);

    const events = await ds.getEvents({ since: 100 }, ['payout.failed']);

    expect((calls.eventParams as { types: string[] }).types).toEqual(['payout.failed']);
    expect(events[0]?.accountId).toBe('acct_1');
  });

  it('lists refunds per account and resolves the charge id', async () => {
    const { stripe, calls } = fakeStripe();
    const ds = createStripeDataSource(stripe);

    const refunds = await ds.getRefunds(['acct_1'], { since: 100 });

    expect(calls.refundAccounts).toEqual(['acct_1']);
    expect(refunds[0]?.chargeId).toBe('ch_1');
  });
});
