import { describe, expect, it } from 'vitest';
import { reconcile, runDetectors } from '../src';
import {
  SYNTHETIC_ACCOUNTS,
  syntheticAppState,
  syntheticDataSource,
  syntheticInput,
} from '../src/synthetic';

describe('synthetic dataset', () => {
  it('syntheticInput triggers all four issue types', () => {
    const issues = runDetectors(syntheticInput());
    const types = new Set(issues.map((issue) => issue.type));
    expect(types).toContain('NEGATIVE_BALANCE_RISK');
    expect(types).toContain('FAILED_PAYOUT');
    expect(types).toContain('UNRECONCILED_REFUND');
    expect(types).toContain('EVENT_GAP');
  });

  it('returns fresh copies each call (no shared mutable state)', () => {
    const a = syntheticInput();
    a.balances?.pop();
    expect(syntheticInput().balances).toHaveLength(2);
  });

  it('drives the full reconcile() flow offline', async () => {
    const report = await reconcile(
      {
        secretKey: 'sk_test_demo',
        accounts: [...SYNTHETIC_ACCOUNTS],
        knownState: syntheticAppState(),
      },
      { dataSource: syntheticDataSource(), now: new Date('2026-06-29T00:00:00.000Z') },
    );

    expect(report.livemode).toBe(false);
    expect(report.summary.critical).toBeGreaterThan(0);
    expect(report.issues.some((issue) => issue.type === 'EVENT_GAP')).toBe(true);
    expect(report.issues.some((issue) => issue.type === 'UNRECONCILED_REFUND')).toBe(true);
  });
});
