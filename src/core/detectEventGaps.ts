import type { AppState, Issue, StripeEventRecord } from './types';
import { CRITICAL_EVENT_TYPES, DEFAULT_RELEVANT_EVENT_TYPES } from './constants';

/**
 * EVENT_GAP — flag financially relevant Stripe events the application has not
 * processed.
 *
 * Requires `appState.processedEventIds` (the set of event ids the app handled).
 * A "gap" is a relevant event whose id is not in that set. When
 * `appState.lastProcessedEventAt` is provided, events created AFTER that point
 * are treated as expected backlog (not yet due) and skipped, so we only flag
 * genuinely missed events. Honest limit: Stripe's Events API only retains events
 * for ~30 days, so gaps older than that window are undetectable here.
 */
export function detectEventGaps(
  events: StripeEventRecord[],
  appState?: AppState,
  relevantEventTypes: readonly string[] = DEFAULT_RELEVANT_EVENT_TYPES,
): Issue[] {
  if (!appState || appState.processedEventIds === undefined) return [];

  const relevant = new Set(relevantEventTypes);
  const critical = new Set(CRITICAL_EVENT_TYPES);
  const processed = new Set(appState.processedEventIds);
  const cutoff = appState.lastProcessedEventAt;
  const issues: Issue[] = [];

  for (const event of events) {
    if (!relevant.has(event.type)) continue;
    if (cutoff !== undefined && event.created > cutoff) continue;
    if (processed.has(event.id)) continue;

    const accountId = event.accountId ?? 'platform';
    const severity: Issue['severity'] = critical.has(event.type) ? 'critical' : 'warning';

    issues.push({
      type: 'EVENT_GAP',
      severity,
      accountId,
      message:
        `Stripe emitted a ${event.type} event (${event.id}) that the application has ` +
        `not processed${event.accountId ? ` for connected account ${event.accountId}` : ''}.`,
      context: {
        eventId: event.id,
        eventType: event.type,
        created: event.created,
        account: event.accountId ?? null,
      },
    });
  }

  return issues;
}
