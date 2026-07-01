# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). While the version is below
1.0 the public API may still change between minor releases.

## [Unreleased]

## [0.1.1] - 2026-07-01

### Changed

- README: added npm version and downloads badges.
- README: documented end-to-end verification against a live Stripe test-mode account.

No changes to the library's code or behavior.

## [0.1.0] - 2026-06-29

Initial release.

### Added

- Pure detection core: `runDetectors` and the four detectors — `NEGATIVE_BALANCE_RISK`,
  `FAILED_PAYOUT`, `UNRECONCILED_REFUND`, `EVENT_GAP` — over domain types decoupled from
  the Stripe SDK.
- Read-only Stripe adapter and the `reconcile(config)` entry point, pinned to
  stripe-node v22 and API version `2026-06-24.dahlia`, returning a structured `Report`.
- Text report renderer `renderReport(report, { color? })`.
- Synthetic dataset under the `stripe-connect-reckon/synthetic` subpath for offline trials.
- Dual ESM + CommonJS build with TypeScript declarations.

### Notes

- Read-only by design: the library never writes to Stripe in v0.

[Unreleased]: https://github.com/tonytonycoder11/stripe-connect-reckon/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/tonytonycoder11/stripe-connect-reckon/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/tonytonycoder11/stripe-connect-reckon/releases/tag/v0.1.0
