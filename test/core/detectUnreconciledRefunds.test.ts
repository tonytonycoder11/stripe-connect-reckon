import { describe, expect, it } from 'vitest';
import { detectUnreconciledRefunds } from '../../src/core';
import { appState, refunds } from './fixtures';

describe('detectUnreconciledRefunds', () => {
  it('stays silent when the app provides no state', () => {
    expect(detectUnreconciledRefunds([refunds.unreconciled])).toEqual([]);
    expect(detectUnreconciledRefunds([refunds.unreconciled], {})).toEqual([]);
  });

  it('flags refunds missing from the processed set', () => {
    const issues = detectUnreconciledRefunds(
      [refunds.reconciled, refunds.unreconciled],
      appState,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.type).toBe('UNRECONCILED_REFUND');
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.context.refundId).toBe('re_unknown');
    expect(issues[0]?.context.paymentIntentId).toBe('pi_2');
  });

  it('treats an empty processed list as "nothing reconciled yet"', () => {
    const issues = detectUnreconciledRefunds([refunds.reconciled], {
      processedRefundIds: [],
    });
    expect(issues).toHaveLength(1);
  });
});
