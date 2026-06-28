import { describe, expect, it } from 'vitest';
import { mapBalance, mapEvent, mapPayout, mapRefund } from '../../src/stripe/mappers';

describe('mappers', () => {
  it('mapBalance copies available/pending per currency', () => {
    const snapshot = mapBalance(
      {
        available: [{ amount: -1500, currency: 'usd' }],
        pending: [{ amount: 500, currency: 'usd' }],
        livemode: false,
      },
      'acct_1',
    );
    expect(snapshot).toEqual({
      accountId: 'acct_1',
      available: [{ currency: 'usd', amount: -1500 }],
      pending: [{ currency: 'usd', amount: 500 }],
      livemode: false,
    });
  });

  it('mapPayout carries status and failure fields', () => {
    const record = mapPayout(
      {
        id: 'po_1',
        amount: 10000,
        currency: 'usd',
        status: 'failed',
        failure_code: 'account_closed',
        failure_message: 'The bank account has been closed.',
        arrival_date: 123,
        automatic: true,
        created: 100,
      },
      'acct_1',
    );
    expect(record.status).toBe('failed');
    expect(record.failureCode).toBe('account_closed');
    expect(record.accountId).toBe('acct_1');
  });

  it('mapRefund resolves an unexpanded charge id and a null payment_intent', () => {
    const record = mapRefund(
      {
        id: 're_1',
        amount: 500,
        currency: 'usd',
        status: 'succeeded',
        charge: 'ch_1',
        payment_intent: null,
        created: 100,
      },
      'acct_1',
    );
    expect(record.chargeId).toBe('ch_1');
    expect(record.paymentIntentId).toBeNull();
  });

  it('mapEvent keeps the originating account, or null for platform events', () => {
    expect(mapEvent({ id: 'evt_1', type: 'payout.failed', created: 1, account: 'acct_1' }).accountId).toBe(
      'acct_1',
    );
    expect(mapEvent({ id: 'evt_2', type: 'balance.available', created: 2 }).accountId).toBeNull();
  });
});
