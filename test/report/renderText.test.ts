import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/report/buildReport';
import { renderReport } from '../../src/report/renderText';

const meta = { generatedAt: '2026-06-29T00:00:00.000Z', livemode: false, accountsChecked: ['acct_1'] };

const report = buildReport(
  [
    { type: 'FAILED_PAYOUT', severity: 'critical', accountId: 'acct_1', message: 'Payout failed.', context: {} },
    { type: 'UNRECONCILED_REFUND', severity: 'warning', accountId: 'acct_1', message: 'Refund missing.', context: {} },
  ],
  meta,
);

describe('renderReport', () => {
  it('renders the summary, severity sections and messages', () => {
    const text = renderReport(report);
    expect(text).toContain('Summary: 1 critical, 1 warning, 0 info');
    expect(text).toContain('mode: test');
    expect(text).toContain('CRITICAL');
    expect(text).toContain('FAILED_PAYOUT  acct_1');
    expect(text).toContain('Payout failed.');
    expect(text).toContain('WARNING');
    // No ANSI escape codes by default.
    expect(text).not.toContain('\x1b[');
  });

  it('handles an issue-free report', () => {
    const empty = buildReport([], { ...meta, livemode: true, accountsChecked: [] });
    const text = renderReport(empty);
    expect(text).toContain('No issues detected.');
    expect(text).toContain('mode: live');
  });

  it('emits ANSI colors when enabled', () => {
    const text = renderReport(report, { color: true });
    expect(text).toContain('\x1b[31m'); // red for critical
    expect(text).toContain('\x1b[0m');
  });
});
