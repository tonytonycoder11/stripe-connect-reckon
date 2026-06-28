import { describe, expect, it } from 'vitest';
import { detectNegativeBalance } from '../../src/core';
import { balances } from './fixtures';

describe('detectNegativeBalance', () => {
  it('flags a negative available balance as critical', () => {
    const issues = detectNegativeBalance([balances.negativeUsd]);
    expect(issues).toHaveLength(1);
    const [issue] = issues;
    expect(issue?.type).toBe('NEGATIVE_BALANCE_RISK');
    expect(issue?.severity).toBe('critical');
    expect(issue?.accountId).toBe('acct_neg');
    expect(issue?.context.availableMinor).toBe(-1500);
    // Pending (500) does NOT fully cover -1500.
    expect(issue?.context.wouldPendingCover).toBe(false);
  });

  it('notes when incoming pending funds would cover the negative', () => {
    const snapshot = {
      accountId: 'acct_cover',
      available: [{ currency: 'usd', amount: -400 }],
      pending: [{ currency: 'usd', amount: 900 }],
    };
    const [issue] = detectNegativeBalance([snapshot]);
    expect(issue?.context.wouldPendingCover).toBe(true);
    expect(issue?.message).toContain('would cover it once available');
  });

  it('produces no issue for a healthy account', () => {
    expect(detectNegativeBalance([balances.healthy])).toEqual([]);
  });

  it('flags a positive-but-below-buffer balance as a warning', () => {
    const issues = detectNegativeBalance([balances.belowBuffer], {
      negativeBalance: { defaultMinor: 500 },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.context.thresholdMinor).toBe(500);
  });

  it('honors per-currency threshold overrides', () => {
    const issues = detectNegativeBalance([balances.belowBuffer], {
      negativeBalance: { defaultMinor: 0, perCurrency: { eur: 1000 } },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.context.thresholdMinor).toBe(1000);
  });

  it('escalates the message when the platform is liable', () => {
    const [issue] = detectNegativeBalance([balances.platformLiable]);
    expect(issue?.severity).toBe('critical');
    expect(issue?.message).toContain('platform is liable');
    expect(issue?.context.lossesLiability).toBe('application');
  });

  it('evaluates each currency independently', () => {
    const issues = detectNegativeBalance([balances.multiCurrency]);
    // usd (-100) and jpy (-50) are negative; eur (5000) is healthy.
    expect(issues).toHaveLength(2);
    const currencies = issues.map((i) => i.context.currency).sort();
    expect(currencies).toEqual(['jpy', 'usd']);
    expect(issues.every((i) => i.severity === 'critical')).toBe(true);
  });
});
