import { describe, expect, it } from 'vitest';
import { detectFailedPayouts } from '../../src/core';
import { payouts } from './fixtures';

describe('detectFailedPayouts', () => {
  it('flags a failed payout as critical with its failure code', () => {
    const [issue] = detectFailedPayouts([payouts.failed]);
    expect(issue?.type).toBe('FAILED_PAYOUT');
    expect(issue?.severity).toBe('critical');
    expect(issue?.accountId).toBe('acct_a');
    expect(issue?.context.failureCode).toBe('insufficient_funds');
    expect(issue?.message).toContain('insufficient_funds');
    expect(issue?.message).toContain('did not reach the bank account');
  });

  it('degrades gracefully when failure_code/message are null', () => {
    const [issue] = detectFailedPayouts([payouts.failedNoReason]);
    expect(issue?.severity).toBe('critical');
    expect(issue?.context.failureCode).toBeNull();
    // No parenthesised code and no trailing reason when both are null.
    expect(issue?.message).not.toContain('(');
  });

  it('flags a canceled payout as a warning', () => {
    const [issue] = detectFailedPayouts([payouts.canceled]);
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('was canceled');
  });

  it('ignores paid payouts', () => {
    expect(detectFailedPayouts([payouts.paid])).toEqual([]);
  });

  it('handles a mixed batch', () => {
    const issues = detectFailedPayouts([
      payouts.failed,
      payouts.paid,
      payouts.canceled,
    ]);
    expect(issues.map((i) => i.severity)).toEqual(['critical', 'warning']);
  });
});
