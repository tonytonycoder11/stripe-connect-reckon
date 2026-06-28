import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/report/buildReport';
import type { Issue } from '../../src';

describe('buildReport', () => {
  it('counts severities and preserves metadata', () => {
    const issues: Issue[] = [
      { type: 'FAILED_PAYOUT', severity: 'critical', accountId: 'acct_1', message: 'm', context: {} },
      { type: 'UNRECONCILED_REFUND', severity: 'warning', accountId: 'acct_1', message: 'm', context: {} },
      { type: 'NEGATIVE_BALANCE_RISK', severity: 'critical', accountId: 'acct_2', message: 'm', context: {} },
    ];

    const report = buildReport(issues, {
      generatedAt: '2026-06-28T00:00:00.000Z',
      livemode: false,
      accountsChecked: ['acct_1', 'acct_2'],
    });

    expect(report.summary).toEqual({ critical: 2, warning: 1, info: 0 });
    expect(report.issues).toHaveLength(3);
    expect(report.accountsChecked).toEqual(['acct_1', 'acct_2']);
    expect(report.livemode).toBe(false);
  });
});
