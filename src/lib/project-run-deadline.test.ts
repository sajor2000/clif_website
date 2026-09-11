import { describe, it, expect } from 'vitest';
import { todayInConsortiumTz, isValidDate, isDeadlineAhead } from './project-run-deadline';

describe('todayInConsortiumTz', () => {
  it('uses the Chicago date, not the UTC date (CDT, UTC-5)', () => {
    expect(todayInConsortiumTz(new Date('2026-09-12T04:30:00Z'))).toBe('2026-09-11');
    expect(todayInConsortiumTz(new Date('2026-09-12T05:30:00Z'))).toBe('2026-09-12');
  });

  it('handles standard time (CST, UTC-6)', () => {
    expect(todayInConsortiumTz(new Date('2026-01-15T05:30:00Z'))).toBe('2026-01-14');
    expect(todayInConsortiumTz(new Date('2026-01-15T06:30:00Z'))).toBe('2026-01-15');
  });
});

describe('isValidDate', () => {
  it('accepts real YYYY-MM-DD dates', () => {
    expect(isValidDate('2026-09-11')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
  });

  it('rejects malformed or impossible dates', () => {
    expect(isValidDate('')).toBe(false);
    expect(isValidDate('2026-9-1')).toBe(false);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('09/11/2026')).toBe(false);
  });
});

describe('isDeadlineAhead', () => {
  it('treats a deadline as still ahead for the whole of that Chicago day', () => {
    // 23:30 Chicago on the deadline day.
    expect(isDeadlineAhead('2026-09-11', new Date('2026-09-12T04:30:00Z'))).toBe(true);
  });

  it('treats a deadline as passed once the Chicago day is over', () => {
    // 08:00 UTC = 03:00 Chicago the next day, when the auto-close job runs.
    expect(isDeadlineAhead('2026-09-11', new Date('2026-09-12T08:00:00Z'))).toBe(false);
  });

  it('accepts future deadlines', () => {
    expect(isDeadlineAhead('2026-10-01', new Date('2026-09-12T08:00:00Z'))).toBe(true);
  });
});
