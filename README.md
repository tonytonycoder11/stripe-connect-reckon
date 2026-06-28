# stripe-connect-reckon

> **Read-only** financial-risk monitor for **Stripe Connect** marketplaces.
> It watches the balances and payouts of your connected accounts and flags
> dangerous conditions **before** they cause damage — an account sliding negative,
> failed payouts, unreconciled refunds, unprocessed events.

This is **not** another Stripe sync engine. It does not copy Stripe objects into your
database. It works one level up: it **detects and alerts**, it never takes corrective
action.

> ⚠️ **Status: early development.** The detection engine is not implemented yet.

## What it detects (v0)

- **`NEGATIVE_BALANCE_RISK`** — a connected account whose available balance is below a
  threshold or negative.
- **`FAILED_PAYOUT`** — a payout in `failed`/`canceled` state on a connected account.
- **`UNRECONCILED_REFUND`** — a refund on Stripe that the app's own state doesn't
  reflect (only when the app passes its state).
- **`EVENT_GAP`** — relevant Stripe events the app declares it hasn't processed
  (within Stripe's 30-day event retention window).

## Safety constraints

- **Read-only.** No transfers, no payouts, no writes — ever, in v0. This is a security
  constraint, not a temporary limitation.
- **Test mode.** No live keys in code or tests; synthetic data only.

## Disclaimer

This is an **unofficial**, community project. It is **not affiliated with, endorsed by,
or sponsored by Stripe, Inc.** "Stripe" and "Stripe Connect" are trademarks of Stripe,
Inc., used here only to describe interoperability.

## License

[MIT](./LICENSE)
