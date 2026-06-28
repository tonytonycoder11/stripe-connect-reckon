/**
 * stripe-connect-reckon — public entry point.
 *
 * Phase 1 exposes the pure detection core (domain types + detectors +
 * runDetectors). The networked, read-only `reconcile(config)` entry point is
 * added in Phase 2 on top of this core.
 */
export * from './core';
