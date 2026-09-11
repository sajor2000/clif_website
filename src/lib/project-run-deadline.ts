/**
 * Project-run Box upload deadlines are plain YYYY-MM-DD dates, due at the END
 * of that day. The consortium runs on Chicago time, so "today" is the Chicago
 * calendar date. The nightly auto-close job and every "must be today or later"
 * check share this one definition so they can never disagree about whether a
 * deadline has passed.
 */

const CONSORTIUM_TZ = 'America/Chicago';

// en-CA formats as YYYY-MM-DD, which compares correctly as a plain string.
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CONSORTIUM_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Chicago as YYYY-MM-DD. */
export function todayInConsortiumTz(now: Date = new Date()): string {
  return dateFormatter.format(now);
}

/** A real calendar date in YYYY-MM-DD form (rejects e.g. 2026-02-30). */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Is this deadline today or later (i.e. not yet passed) in Chicago? */
export function isDeadlineAhead(deadline: string, now: Date = new Date()): boolean {
  return deadline >= todayInConsortiumTz(now);
}
