import { describe, expect, it } from 'vitest';
import {
  MAX_SLIDE_ROWS,
  buildWeeklySlideRequests,
  deadlineCell,
  longDateLabel,
  sitesCell,
  weeklySlideObjectId,
  type WeeklyRunRow,
} from './weekly-run-slide';

function run(over: Partial<WeeklyRunRow> = {}): WeeklyRunRow {
  return {
    label: '12',
    title: 'Prone positioning',
    status: 'open',
    conference: 'ATS 2027',
    deadline: '2026-11-20',
    daysLeft: 16,
    ran: 6,
    applicable: 10,
    ...over,
  };
}

const base = { slideId: 'weeklyRuns_20261104', pageWidth: 9144000, pageHeight: 5143500, dateLabel: 'Wednesday, November 4, 2026', trackerUrl: 'https://clif-icu.com/portal/project-runs' };

function cellTexts(requests: Record<string, unknown>[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of requests) {
    const t = r.insertText as any;
    if (t?.cellLocation) m.set(`${t.cellLocation.rowIndex},${t.cellLocation.columnIndex}`, t.text);
  }
  return m;
}

describe('weekly slide helpers', () => {
  it('derives a Slides-safe object id from the Chicago date', () => {
    expect(weeklySlideObjectId('2026-11-04')).toBe('weeklyRuns_20261104');
  });

  it('formats dates without timezone drift', () => {
    expect(longDateLabel('2026-11-04')).toBe('Wednesday, November 4, 2026');
    expect(deadlineCell({ deadline: '2026-11-20', daysLeft: 16 })).toBe('Nov 20 · 16 days left');
    expect(deadlineCell({ deadline: '2026-11-05', daysLeft: 1 })).toBe('Nov 5 · 1 day left');
    expect(deadlineCell({ deadline: '2026-11-04', daysLeft: 0 })).toBe('Nov 4 · today');
    expect(deadlineCell({ deadline: null, daysLeft: null })).toBe('TBD');
  });

  it('shows site tallies only for active runs', () => {
    expect(sitesCell({ status: 'open', ran: 6, applicable: 10 })).toBe('6 / 10');
    expect(sitesCell({ status: 'upcoming', ran: null, applicable: null })).toBe('—');
  });
});

describe('buildWeeklySlideRequests', () => {
  it('creates the slide first, at the front, with a header row and one row per run', () => {
    const reqs = buildWeeklySlideRequests({ ...base, runs: [run(), run({ label: '13 (run 2)', status: 'upcoming', deadline: null, daysLeft: null, ran: null, applicable: null, conference: null })] });
    const create = reqs[0].createSlide as any;
    expect(create.objectId).toBe('weeklyRuns_20261104');
    expect(create.insertionIndex).toBe(0);

    const table = reqs.find((r) => r.createTable)!.createTable as any;
    expect(table.rows).toBe(3);
    expect(table.columns).toBe(5);
    expect(table.elementProperties.pageObjectId).toBe('weeklyRuns_20261104');

    const cells = cellTexts(reqs);
    expect(cells.get('0,0')).toBe('#');
    expect(cells.get('1,1')).toBe('Prone positioning · ATS 2027');
    expect(cells.get('1,2')).toBe('Active');
    expect(cells.get('1,3')).toBe('Nov 20 · 16 days left');
    expect(cells.get('1,4')).toBe('6 / 10');
    expect(cells.get('2,0')).toBe('13 (run 2)');
    expect(cells.get('2,2')).toBe('Upcoming');
    expect(cells.get('2,3')).toBe('TBD');
    expect(cells.get('2,4')).toBe('—');

    const title = reqs.find((r) => (r.insertText as any)?.objectId === 'weeklyRuns_20261104_title')!.insertText as any;
    expect(title.text).toBe('Active CLIF project runs · Wednesday, November 4, 2026');
  });

  it('renders an empty state instead of a table when nothing is active', () => {
    const reqs = buildWeeklySlideRequests({ ...base, runs: [] });
    expect(reqs.some((r) => r.createTable)).toBe(false);
    const empty = reqs.find((r) => (r.insertText as any)?.objectId === 'weeklyRuns_20261104_empty')!.insertText as any;
    expect(empty.text).toMatch(/No active or upcoming project runs/);
  });

  it('caps the table and notes the overflow in the footer', () => {
    const runs = Array.from({ length: MAX_SLIDE_ROWS + 3 }, (_, k) => run({ label: String(k + 1) }));
    const reqs = buildWeeklySlideRequests({ ...base, runs });
    expect((reqs.find((r) => r.createTable)!.createTable as any).rows).toBe(MAX_SLIDE_ROWS + 1);
    const footer = reqs.find((r) => (r.insertText as any)?.objectId === 'weeklyRuns_20261104_footer')!.insertText as any;
    expect(footer.text).toMatch(/^\+3 more runs on the tracker\./);
    expect(footer.text).toContain(base.trackerUrl);
  });

  it('never sends an empty text insert, which the Slides API rejects', () => {
    const reqs = buildWeeklySlideRequests({ ...base, runs: [run({ label: '' })] });
    for (const r of reqs) if (r.insertText) expect((r.insertText as any).text.length).toBeGreaterThan(0);
  });
});
