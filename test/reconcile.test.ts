import { describe, expect, it, vi } from 'vitest';
import { reconcile } from '../src';
import type { ReconcileDataSource } from '../src';

/** A fake data source with spy methods, returning synthetic DTOs. No network. */
function fakeDataSource(overrides: Partial<ReconcileDataSource> = {}) {
  return {
    getBalances: vi.fn(async () => [
      { accountId: 'acct_1', available: [{ currency: 'usd', amount: -100 }], pending: [] },
    ]),
    getPayouts: vi.fn(async () => [
      { id: 'po_1', accountId: 'acct_1', amount: 1000, currency: 'usd', status: 'failed' as const, created: 1 },
    ]),
    getRefunds: vi.fn(async () => [
      { id: 're_2', accountId: 'acct_1', amount: 500, currency: 'usd', created: 2 },
    ]),
    getEvents: vi.fn(async () => [
      { id: 'evt_1', type: 'payout.failed', created: 3, accountId: 'acct_1' },
    ]),
    ...overrides,
  };
}

const NOW = new Date('2026-06-28T00:00:00.000Z');

describe('reconcile', () => {
  it('builds a report and skips refunds/events when no app state is supplied', async () => {
    const ds = fakeDataSource();
    const report = await reconcile(
      { secretKey: 'sk_test_x', accounts: ['acct_1'] },
      { dataSource: ds as unknown as ReconcileDataSource, now: NOW },
    );

    expect(ds.getBalances).toHaveBeenCalledOnce();
    expect(ds.getPayouts).toHaveBeenCalledOnce();
    expect(ds.getRefunds).not.toHaveBeenCalled();
    expect(ds.getEvents).not.toHaveBeenCalled();

    // Negative balance + failed payout => two critical issues.
    expect(report.summary.critical).toBe(2);
    expect(report.livemode).toBe(false);
    expect(report.generatedAt).toBe('2026-06-28T00:00:00.000Z');
    expect(report.accountsChecked).toEqual(['acct_1']);
  });

  it('fetches refunds and events when knownState provides the sets', async () => {
    const ds = fakeDataSource();
    const report = await reconcile(
      {
        secretKey: 'sk_test_x',
        accounts: ['acct_1'],
        knownState: { processedRefundIds: [], processedEventIds: [], lastProcessedEventAt: 9_999_999_999 },
      },
      { dataSource: ds as unknown as ReconcileDataSource, now: NOW },
    );

    expect(ds.getRefunds).toHaveBeenCalledOnce();
    expect(ds.getEvents).toHaveBeenCalledOnce();
    const types = report.issues.map((i) => i.type);
    expect(types).toContain('UNRECONCILED_REFUND');
    expect(types).toContain('EVENT_GAP');
  });

  it('infers livemode from the key when no balances are returned', async () => {
    const ds = fakeDataSource({
      getBalances: vi.fn(async () => []),
      getPayouts: vi.fn(async () => []),
    });
    const report = await reconcile(
      { secretKey: 'sk_live_x', accounts: [] },
      { dataSource: ds as unknown as ReconcileDataSource, now: NOW },
    );
    expect(report.livemode).toBe(true);
  });
});
