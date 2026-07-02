# stripe-connect-reckon

[![npm version](https://img.shields.io/npm/v/stripe-connect-reckon.svg)](https://www.npmjs.com/package/stripe-connect-reckon)
[![npm downloads](https://img.shields.io/npm/dm/stripe-connect-reckon.svg)](https://www.npmjs.com/package/stripe-connect-reckon)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D24-339933.svg)](https://nodejs.org)

A read-only safety net for Stripe Connect marketplaces. It watches the balances and
payouts of your connected accounts and surfaces the financial conditions that quietly
break a marketplace — an account drifting negative, a payout that failed, a refund your
system never reconciled — so you hear about them from a monitor instead of from a
seller whose refund won't go through.

It was born from a real incident: on a marketplace using direct charges, a connected
account went negative, Stripe suspended its payouts, and the seller's refunds silently
queued as `pending`. Nothing errored. Nothing alerted. The money problem only became
visible once a customer complained. This library exists to catch that earlier.

It is **not** a sync engine. It doesn't mirror Stripe objects into your database — tools
like `@supabase/stripe-sync-engine` already do that well. It works one level up: it
reads, evaluates, and reports. It never writes to Stripe.

## What it watches

- **`NEGATIVE_BALANCE_RISK`** — a connected account whose available balance is negative,
  or below a buffer you configure, evaluated per currency.
- **`FAILED_PAYOUT`** — a payout in `failed` or `canceled` state, with its failure code
  and reason where Stripe provides them.
- **`UNRECONCILED_REFUND`** — a refund that exists on Stripe but is missing from the
  state your application reports.
- **`EVENT_GAP`** — a financially relevant event Stripe emitted that your application
  hasn't processed, within Stripe's 30-day event window.

Every finding is a plain `Issue`: a type, a severity (`info` / `warning` / `critical`),
the account it belongs to, a human-readable message, and the raw fields that triggered
it.

## Read-only by design

The library only ever calls Stripe's read endpoints. It does not transfer funds, create
or cancel payouts, issue refunds, or modify accounts — in this version or any planned
one. Detection and remediation are different jobs with different blast radii, and a tool
that watches your money should not also be able to move it. Removing that boundary would
be a deliberate decision, not an incremental feature.

## Project status

The detection core, the read-only Stripe adapter and `reconcile()`, the structured report
with a text renderer, and a synthetic dataset for offline trials are all implemented and
tested (47 tests, no network in the suite). What remains is polish, not core capability
(see [Roadmap](#roadmap)).

It has been verified end-to-end against a live Stripe **test-mode** account:
authentication and the pinned API version, the read-only reads (`balance`, `payouts`,
`events`, `refunds`, including the per-account `Stripe-Account` path), detection, and
report rendering all work against the real API. The detectors are also covered by unit
tests against synthetic fixtures and a stubbed client.

If you already hold balance, payout, or event data, the core is usable directly;
otherwise `reconcile()` collects it for you.

## Install

```sh
npm install stripe-connect-reckon
```

Requires Node.js 24 or newer. Ships both ESM and CommonJS builds with type
declarations.

## Quick start

Feed the engine the data you have; get back a sorted list of issues, most severe first.

```ts
import { runDetectors } from 'stripe-connect-reckon';

const issues = runDetectors({
  balances: [
    {
      accountId: 'acct_123',
      available: [{ currency: 'usd', amount: -2500 }], // minor units: -$25.00
      pending: [{ currency: 'usd', amount: 1000 }],
    },
  ],
  payouts: [
    {
      id: 'po_1',
      accountId: 'acct_123',
      amount: 50000,
      currency: 'usd',
      status: 'failed',
      failureCode: 'account_closed',
      created: 1719500000,
    },
  ],
});

for (const issue of issues) {
  console.log(`[${issue.severity}] ${issue.type} — ${issue.message}`);
}
```

```text
[critical] FAILED_PAYOUT — Payout po_1 of $500.00 on connected account acct_123 FAILED (account_closed). The funds did not reach the bank account.
[critical] NEGATIVE_BALANCE_RISK — Available balance is -$25.00 (negative) on connected account acct_123. While negative, Stripe suspends payouts for this account and refunds may be blocked.
```

Amounts are integers in the smallest currency unit, exactly as Stripe represents them.
Messages format them correctly per currency, including zero-decimal currencies such as
JPY.

## Reconciling against your own state

Two of the detectors compare Stripe against what your application believes it has
processed. They stay silent unless you supply that state — there is no honest way to
know what you missed without a reference point.

```ts
import { runDetectors } from 'stripe-connect-reckon';

const issues = runDetectors({
  refunds: [
    { id: 're_1', accountId: 'acct_123', amount: 1000, currency: 'usd', created: 1719500000 },
    { id: 're_2', accountId: 'acct_123', amount: 2500, currency: 'usd', created: 1719500100 },
  ],
  events: [
    { id: 'evt_1', type: 'payout.failed', created: 1719500200, accountId: 'acct_123' },
  ],
  appState: {
    processedRefundIds: ['re_1'],          // re_2 will be flagged
    processedEventIds: [],                  // evt_1 will be flagged
    lastProcessedEventAt: 1719500300,       // events after this are treated as backlog
  },
});
```

## Connecting to Stripe

`reconcile()` wires the read-only Stripe adapter to the core, so you don't assemble the
input by hand. Give it a secret key and the accounts to inspect; it reads balances and
payouts (and, when you pass `knownState`, refunds and events), runs detection, and
returns a structured `Report`.

```ts
import { reconcile } from 'stripe-connect-reckon';

const report = await reconcile({
  secretKey: process.env.STRIPE_SECRET_KEY!, // use a test-mode key (sk_test_...)
  accounts: ['acct_123', 'acct_456'],
  // optional: the refund/event ids your app has already processed
  knownState: { processedRefundIds: [], processedEventIds: [] },
});

console.log(report.summary); // { critical, warning, info }
report.issues.forEach((i) => console.log(`[${i.severity}] ${i.type} — ${i.message}`));
```

The client is pinned to stripe-node v22 and API version `2026-06-24.dahlia`. The
`Stripe-Account` header, pagination, and the 30-day event window are handled for you.
Balances and payouts are read on every run; refunds and events are fetched only when
`knownState` gives the corresponding detectors something to compare against. Lookups
default to the last 30 days and can be narrowed with `window`.

## Rendering a report

`renderReport(report)` turns a `Report` into readable text for logs or CI output. Pass
`{ color: true }` for ANSI-colored severities in a terminal. A full sample is shown in the
next section.

```ts
import { reconcile, renderReport } from 'stripe-connect-reckon';

const report = await reconcile({
  secretKey: process.env.STRIPE_SECRET_KEY!,
  accounts: ['acct_123'],
});
console.log(renderReport(report));
```

## Try it without a Stripe account

The `stripe-connect-reckon/synthetic` subpath ships a dataset that triggers every issue
type, plus a fake data source, so you can run the whole flow offline.

```ts
import { reconcile, renderReport } from 'stripe-connect-reckon';
import {
  syntheticDataSource,
  syntheticAppState,
  SYNTHETIC_ACCOUNTS,
} from 'stripe-connect-reckon/synthetic';

const report = await reconcile(
  { secretKey: 'sk_test_demo', accounts: [...SYNTHETIC_ACCOUNTS], knownState: syntheticAppState() },
  { dataSource: syntheticDataSource() },
);
console.log(renderReport(report));
```

```text
stripe-connect-reckon report
Generated 2026-06-29T00:00:00.000Z  ·  mode: test  ·  accounts: 3
Summary: 3 critical, 2 warning, 0 info

CRITICAL
  ✗ EVENT_GAP  acct_payouts
    Stripe emitted a payout.failed event (evt_missed) that the application has not processed for connected account acct_payouts.
  ✗ FAILED_PAYOUT  acct_payouts
    Payout po_failed of $500.00 on connected account acct_payouts FAILED (account_closed). The funds did not reach the bank account. Reason: The bank account has been closed.
  ✗ NEGATIVE_BALANCE_RISK  acct_negative
    Available balance is -$32.00 (negative) on connected account acct_negative. While negative, Stripe suspends payouts for this account and refunds may be blocked. The platform is liable for this negative balance.

WARNING
  ! FAILED_PAYOUT  acct_payouts
    Payout po_canceled of $120.00 on connected account acct_payouts was canceled.
  ! UNRECONCILED_REFUND  acct_payouts
    Refund re_orphan ($45.00) exists on Stripe but is not in the application's processed-refunds state for connected account acct_payouts.
```

Or feed the core directly with `runDetectors(syntheticInput())`.

## Roadmap

- Optional per-account liability enrichment (`losses_collector` /
  `debit_negative_balances`) to sharpen severity for platform-liable accounts.
- Concurrency with throttling for platforms that inspect many connected accounts.

## API

### `runDetectors(input): Issue[]`

Runs every detector over `input` and returns issues sorted by severity, then type, then
account. Pure and deterministic.

```ts
interface DetectionInput {
  balances?: BalanceSnapshot[];
  payouts?: PayoutRecord[];
  refunds?: RefundRecord[];
  events?: StripeEventRecord[];
  appState?: AppState;
  thresholds?: ReconcileThresholds;
  relevantEventTypes?: string[]; // override which event types count for EVENT_GAP
}

interface Issue {
  type: 'NEGATIVE_BALANCE_RISK' | 'FAILED_PAYOUT' | 'UNRECONCILED_REFUND' | 'EVENT_GAP';
  severity: 'info' | 'warning' | 'critical';
  accountId: string;          // connected account id, or "platform"
  message: string;            // human-readable, self-contained
  context: Record<string, unknown>; // the raw fields that triggered it
}
```

The individual detectors — `detectNegativeBalance`, `detectFailedPayouts`,
`detectUnreconciledRefunds`, `detectEventGaps` — are exported too, if you want to run one
in isolation or compose your own pipeline.

### `reconcile(config, deps?): Promise<Report>`

Fetches data through the read-only Stripe adapter and runs detection.

```ts
interface ReconcileConfig {
  secretKey: string;            // test-mode key in v0
  accounts: string[];           // acct_... to inspect
  apiVersion?: string;          // defaults to 2026-06-24.dahlia
  thresholds?: ReconcileThresholds;
  knownState?: AppState;        // enables UNRECONCILED_REFUND / EVENT_GAP
  window?: { since?: Date; until?: Date }; // defaults to the last 30 days
  maxItemsPerList?: number;     // pagination cap, default 1000
  relevantEventTypes?: string[];
}

interface Report {
  generatedAt: string;          // ISO-8601
  livemode: boolean;
  accountsChecked: string[];
  issues: Issue[];
  summary: { critical: number; warning: number; info: number };
}
```

`deps` is for testing: pass `{ dataSource }` to inject a fake `ReconcileDataSource` and
skip the network entirely. The Stripe-backed source is also exported as
`createStripeDataSource(stripe, options)` if you want to supply your own configured
client.

### Thresholds

By default an available balance is flagged only once it goes negative. Set a buffer to be
warned earlier, globally or per currency (in minor units):

```ts
runDetectors({
  balances,
  thresholds: {
    negativeBalance: {
      defaultMinor: 5000,            // warn under $50.00 for most currencies
      perCurrency: { jpy: 500000 },  // ¥500,000 for JPY
    },
  },
});
```

### Application state

```ts
interface AppState {
  processedRefundIds?: string[];   // enables UNRECONCILED_REFUND
  processedEventIds?: string[];    // enables EVENT_GAP
  lastProcessedEventAt?: number;   // Unix seconds; events after it are backlog, not gaps
}
```

Also exported: `renderReport`, `buildReport`, `createStripeDataSource`,
`DEFAULT_RELEVANT_EVENT_TYPES`, `CRITICAL_EVENT_TYPES`, and `formatMoney`. The synthetic
helpers live under `stripe-connect-reckon/synthetic`.

## How the detectors map to Stripe

A short tour of the behavior each one keys on, because the nuances matter.

**Negative balance.** A connected account's balance is read per currency and can go
negative. While it is, Stripe suspends that account's payouts, which is how refunds end
up stuck. Who actually absorbs the loss depends on your charge flow: with *direct
charges* the connected account is liable, so its balance is the thing to watch; with
*destination charges* or *separate charges and transfers* the platform is liable, and the
account's own balance tells you less. The detector reports the condition — you bring the
flow context.

**Failed payout.** Keyed on `status` being `failed` or `canceled`, with `failure_code`
and `failure_message` included when present (Stripe populates them only when available, so
the message degrades cleanly when they're absent). Note that a payout can briefly read
`paid` before flipping to `failed`; the upcoming adapter cross-checks the `payout.failed`
event rather than trusting a single snapshot.

**Unreconciled refund** and **event gap.** Both compare Stripe against your reported
state. Events are only retrievable from Stripe for 30 days, so gaps older than that window
cannot be detected here — that is a property of the Events API, not a limitation we can
engineer away.

## Limitations

Worth knowing before you rely on it:

- It detects and alerts; it never remediates.
- `UNRECONCILED_REFUND` and `EVENT_GAP` require you to pass your application's state.
- The event window is 30 days; older gaps are invisible.
- A balance is a point-in-time reading. A momentary negative may be covered by incoming
  `pending` funds (the issue notes when that's the case), and a healthy balance now can
  degrade later. Thresholds are a heuristic, not a forecast.
- Balances are per currency. Amounts in different currencies are never combined.
- Inspecting many connected accounts is one set of API calls per account; large platforms
  will want throttling, which the adapter will handle.

## Versioning

This is **v0** (pre-1.0). The read-only guarantee is fixed and intentional, but the public
API may change between minor versions until 1.0. Changes are recorded in
[CHANGELOG.md](./CHANGELOG.md).

## Support

If this project is useful to you, you can support its development:

[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/tonytonycoder11)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/tonytonycoder)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/tonytonycoder)
[![PayPal](https://img.shields.io/badge/PayPal-00457C?logo=paypal&logoColor=white)](https://www.paypal.com/paypalme/nacode11)

## License

[MIT](./LICENSE)

---

This is an independent, community project. It is not affiliated with, endorsed by, or
sponsored by Stripe, Inc. "Stripe" and "Stripe Connect" are trademarks of Stripe, Inc.,
referenced here only to describe interoperability.
