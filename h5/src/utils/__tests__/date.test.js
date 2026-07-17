import { describe, expect, it } from 'vitest';
import { dateStr, daysBetween, addDays } from '../date.js';

describe('dateStr', () => {
  it('uses local calendar date not UTC', () => {
    const d = new Date(2026, 6, 16, 23, 30);
    expect(dateStr(d)).toBe('2026-07-16');
  });
});

describe('daysBetween', () => {
  it('counts whole days between date strings', () => {
    expect(daysBetween('2026-07-16', '2026-07-18')).toBe(2);
  });
});

describe('addDays', () => {
  it('advances by given days', () => {
    expect(addDays('2026-07-16', 3)).toBe('2026-07-19');
  });
});
