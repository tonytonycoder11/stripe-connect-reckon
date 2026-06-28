# Contributing

Thanks for your interest. This is an early-stage, **read-only** library, and that is a
hard design constraint: nothing here may write to Stripe (no transfers, payouts, refunds,
or account changes) in v0. Please don't add code that mutates Stripe state — detection
and remediation are deliberately kept separate.

## Development

- Node.js >= 24 (`.nvmrc` pins 24).
- `npm install`
- `npm run typecheck` — strict TypeScript, no emit.
- `npm test` — Vitest. The suite runs with **no network**: the core uses synthetic
  fixtures and the Stripe adapter is tested against a stubbed client.
- `npm run build` — dual ESM/CJS build with type declarations (tsup).

## Architecture

The layering is intentional and dependencies point inward:

- `src/core/` — pure domain logic and types. No I/O, no `stripe` import. New detectors
  are pure functions over plain DTOs.
- `src/stripe/` — the read-only adapter. It only calls list/retrieve endpoints and maps
  SDK objects to core DTOs.
- `src/report/` — structured `Report` and the text renderer.
- `src/reconcile.ts` — the use-case that wires a data source to the core.

## Pull requests

Keep `src/core` free of I/O and Stripe types, add tests for new behavior, and make sure
`npm run typecheck`, `npm test`, and `npm run build` all pass.
