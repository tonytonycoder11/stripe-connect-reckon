import { describe, expect, it } from 'vitest';
import { formatMoney } from '../../src/core';

describe('formatMoney', () => {
  it('formats two-decimal currencies (USD) from minor units', () => {
    expect(formatMoney(250000, 'usd')).toBe('$2,500.00');
    expect(formatMoney(-1500, 'usd')).toBe('-$15.00');
  });

  it('formats zero-decimal currencies (JPY) without dividing by 100', () => {
    expect(formatMoney(-50, 'jpy')).toBe('-¥50');
    expect(formatMoney(5000, 'jpy')).toBe('¥5,000');
  });

  it('uppercases the currency code internally', () => {
    expect(formatMoney(100, 'eur')).toBe('€1.00');
  });

  it('falls back gracefully for malformed currency codes', () => {
    expect(formatMoney(100, 'zz')).toBe('100 ZZ (minor units)');
  });
});
