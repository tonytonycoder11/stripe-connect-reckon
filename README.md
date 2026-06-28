# stripe-connect-reckon

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D24-339933.svg)](https://nodejs.org)
[![Status](https://img.shields.io/badge/status-early%20development-orange.svg)](#project-status)

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

The detection core is implemented and tested: the domain model, the four detectors, and
the `runDetectors` engine all run today against plain data, with no network access. The
read-only Stripe adapter and the top-level `reconcile()` entry point — which fetch data
and feed the core — are implemented and unit-tested against a stubbed client. A text
renderer for the report and helper tooling round out the next milestone (see
[Roadmap](#roadmap)).

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
  knownState: { processedRefundIds, processedEventIds }, // optional
});

console.log(report.summary); // { critical, warning, info }
report.issues.forEach((i) => console.log(`[${i.severity}] ${i.type} — ${i.message}`));
```

The client is pinned to stripe-node v22 and API version `2026-06-24.dahlia`. The
`Stripe-Account` header, pagination, and the 30-day event window are handled for you.
Balances and payouts are read on every run; refunds and events are fetched only when
`knownState` gives the corresponding detectors something to compare against. Lookups
default to the last 30 days and can be narrowed with `window`.

## Roadmap

- A text renderer for `Report`, for readable logs and CI output next to the structured
  object.
- A synthetic data generator, to exercise the detectors without a Stripe account.
- Optional per-account liability enrichment (`losses_collector` /
  `debit_negative_balances`) to sharpen severity for platform-liable accounts.

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

Also exported: `DEFAULT_RELEVANT_EVENT_TYPES`, `CRITICAL_EVENT_TYPES`, and `formatMoney`.

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

## License

[MIT](./LICENSE)

---

This is an independent, community project. It is not affiliated with, endorsed by, or
sponsored by Stripe, Inc. "Stripe" and "Stripe Connect" are trademarks of Stripe, Inc.,
referenced here only to describe interoperability.
