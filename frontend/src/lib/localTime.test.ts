import { describe, expect, it } from 'vitest';
import {
  datetimeLocalToUtcIso,
  localDateTimeLocalInputValue,
  nowMs,
  nowUtcIso,
} from './localTime';

describe('localTime', () => {
  it('localDateTimeLocalInputValue matches local calendar fields', () => {
    const d = new Date(2026, 5, 2, 14, 30, 0, 0);
    expect(localDateTimeLocalInputValue(d)).toBe('2026-06-02T14:30');
  });

  it('does not use UTC components for datetime-local default', () => {
    const d = new Date(2026, 0, 15, 23, 45, 0, 0);
    const local = localDateTimeLocalInputValue(d);
    const utcSlice = d.toISOString().slice(0, 16);
    expect(local).toBe('2026-01-15T23:45');
    expect(local).not.toBe(utcSlice);
  });

  it('datetimeLocalToUtcIso preserves local wall-clock intent', () => {
    const iso = datetimeLocalToUtcIso('2026-06-02T14:30');
    const parsed = new Date(iso);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(2);
    expect(parsed.getHours()).toBe(14);
    expect(parsed.getMinutes()).toBe(30);
  });

  it('nowUtcIso aligns with nowMs instant', () => {
    const ms = nowMs();
    const iso = nowUtcIso();
    expect(Math.abs(new Date(iso).getTime() - ms)).toBeLessThan(5);
  });
});
