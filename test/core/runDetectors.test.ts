import { describe, expect, it } from 'vitest';
import { runDetectors } from '../../src/core';
import { appState, balances, events, payouts, refunds } from './fixtures';

describe('runDetectors', () => {
  it('returns an empty list for empty input', () => {
    expect(runDetectors({})).toEqual([]);
  });

  it('aggregates issues from every detector', () => {
    const issues = runDetectors({
      balances: [balances.negativeUsd],
      payouts: [payouts.failed, payouts.canceled, payouts.paid],
      refunds: [refunds.reconciled, refunds.unreconciled],
      events: [events.payoutFailed, events.chargeRefunded, events.futureRefund],
      appState,
    });

    const types = issues.map((i) => i.type);
    expect(types).toContain('NEGATIVE_BALANCE_RISK');
    expect(types).toContain('FAILED_PAYOUT');
    expect(types).toContain('UNRECONCILED_REFUND');
    expect(types).toContain('EVENT_GAP');
  });

  it('sorts issues by severity (critical first)', () => {
    const issues = runDetectors({
      balances: [balances.negativeUsd], // critical
      payouts: [payouts.canceled], // warning
      refunds: [refunds.unreconciled], // warning (needs appState)
      appState,
    });

    const rank = { critical: 0, warning: 1, info: 2 } as const;
    for (let i = 1; i < issues.length; i++) {
      const prev = issues[i - 1];
      const cur = issues[i];
      if (!prev || !cur) continue;
      expect(rank[prev.severity]).toBeLessThanOrEqual(rank[cur.severity]);
    }
    expect(issues[0]?.severity).toBe('critical');
  });

  it('omits refund/event issues when no appState is supplied', () => {
    const issues = runDetectors({
      balances: [balances.healthy],
      refunds: [refunds.unreconciled],
      events: [events.payoutFailed],
    });
    expect(issues).toEqual([]);
  });
});
