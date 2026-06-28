import { describe, expect, it } from 'vitest';
import { detectEventGaps } from '../../src/core';
import { appState, events } from './fixtures';

describe('detectEventGaps', () => {
  it('stays silent when the app provides no processed-event state', () => {
    expect(detectEventGaps([events.payoutFailed])).toEqual([]);
    expect(detectEventGaps([events.payoutFailed], {})).toEqual([]);
  });

  it('flags an unprocessed relevant event and escalates payout.failed to critical', () => {
    const issues = detectEventGaps(
      [events.payoutFailed, events.chargeRefunded, events.irrelevant, events.futureRefund],
      appState,
    );
    // chargeRefunded is processed; irrelevant is filtered out; futureRefund is
    // after the cutoff (backlog). Only payoutFailed remains as a gap.
    expect(issues).toHaveLength(1);
    expect(issues[0]?.type).toBe('EVENT_GAP');
    expect(issues[0]?.severity).toBe('critical');
    expect(issues[0]?.context.eventType).toBe('payout.failed');
    expect(issues[0]?.accountId).toBe('acct_a');
  });

  it('treats events newer than lastProcessedEventAt as backlog, not gaps', () => {
    const issues = detectEventGaps([events.futureRefund], {
      processedEventIds: [],
      lastProcessedEventAt: 2000,
    });
    expect(issues).toEqual([]);
  });

  it('flags relevant events as gaps when no cutoff is set', () => {
    const issues = detectEventGaps([events.futureRefund], { processedEventIds: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
  });

  it('labels platform-scoped events with accountId "platform"', () => {
    const issues = detectEventGaps([events.platformBalance], { processedEventIds: [] });
    expect(issues[0]?.accountId).toBe('platform');
    expect(issues[0]?.context.account).toBeNull();
  });

  it('respects a custom relevant-event-type list', () => {
    const issues = detectEventGaps(
      [events.payoutFailed, events.chargeRefunded],
      { processedEventIds: [] },
      ['charge.refunded'],
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.context.eventType).toBe('charge.refunded');
  });
});
