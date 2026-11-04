import { getDb } from './turso';
import { daysBetween, todayInConsortiumTz } from './project-run-deadline';
import { SITES_NOT_YET_RUNNING } from './project-run-reminders';
import { runLabel, toProjectRunStatus } from './project-run-status';
import { getServiceAccountAccessToken, parseServiceAccountKey } from './google-service-account';

/**
 * Weekly project-run summary slide.
 *
 * Every Thursday at 9am Chicago (vercel.json cron -> /api/project-runs/weekly-slide)
 * a new slide is inserted at the FRONT of the consortium's standing meeting deck
 * listing every active and upcoming project run: number, title, status, Box
 * upload deadline, how many applicable sites have run it, and which sites
 * still have not. Older weekly
 * slides are left in place below it as a running history.
 *
 * The deck is a Google Slides file shared (as Editor) with the service
 * account in GOOGLE_SERVICE_ACCOUNT_JSON; its id is
 * WEEKLY_SLIDE_PRESENTATION_ID. Each slide's objectId encodes the Thursday
 * of the week it belongs to, so there is exactly one slide per week: an admin
 * pushing one by hand on Wednesday satisfies that week, and the Thursday cron
 * (or a second click) finds it and does nothing.
 */

export const SLIDES_SCOPE = 'https://www.googleapis.com/auth/presentations';
/** Rows that fit on one slide at 9pt with a pending-sites column; anything beyond is summarised in the footer. */
export const MAX_SLIDE_ROWS = 10;

export interface WeeklyRunRow {
  label: string; // "12" or "12 (run 2)"; "" when unnumbered
  title: string;
  status: 'open' | 'upcoming';
  conference: string | null;
  deadline: string | null; // YYYY-MM-DD
  daysLeft: number | null;
  ran: number | null;
  applicable: number | null;
  /** Applicable sites that have not run it yet (open runs only). */
  pending: string[];
}

export interface WeeklySlideInput {
  slideId: string;
  pageWidth: number; // EMU
  pageHeight: number; // EMU
  dateLabel: string;
  runs: WeeklyRunRow[];
  trackerUrl: string;
}

/**
 * The Thursday of the Monday-to-Sunday week containing the date: the key under
 * which that week's slide is filed, whatever day it was generated on.
 */
export function weekAnchor(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const mondayOffset = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - mondayOffset + 3);
  return date.toISOString().slice(0, 10);
}

/** "weeklyRuns_20261105" for any day in the week of Thursday 2026-11-05 (Slides-safe characters only). */
export function weeklySlideObjectId(ymd: string): string {
  return `weeklyRuns_${weekAnchor(ymd).replace(/-/g, '')}`;
}

/** "Wednesday, November 4, 2026" from a YYYY-MM-DD string, no timezone drift. */
export function longDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function deadlineCell(r: Pick<WeeklyRunRow, 'deadline' | 'daysLeft'>): string {
  if (!r.deadline) return 'TBD';
  if (r.daysLeft == null) return shortDate(r.deadline);
  if (r.daysLeft < 0) return `${shortDate(r.deadline)} · overdue`;
  if (r.daysLeft === 0) return `${shortDate(r.deadline)} · today`;
  return `${shortDate(r.deadline)} · ${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} left`;
}

export function sitesCell(r: Pick<WeeklyRunRow, 'status' | 'ran' | 'applicable'>): string {
  if (r.status !== 'open' || r.ran == null || r.applicable == null) return '—';
  return `${r.ran} / ${r.applicable}`;
}

export function pendingCell(r: Pick<WeeklyRunRow, 'status' | 'pending'>): string {
  if (r.status !== 'open') return '—';
  return r.pending.length === 0 ? 'None — all sites done' : r.pending.join(', ');
}

const EMU_PER_INCH = 914400;
const BURGUNDY = { red: 0.545, green: 0.082, blue: 0.22 };
const GRAY = { red: 0.42, green: 0.447, blue: 0.502 };
const WHITE = { red: 1, green: 1, blue: 1 };
const COLUMN_FRACTIONS = [0.06, 0.3, 0.1, 0.14, 0.1, 0.3];
const HEADERS = ['#', 'Project', 'Status', 'Deadline', 'Sites run', 'Pending sites'];

function emu(v: number) {
  return { magnitude: Math.round(v), unit: 'EMU' };
}
function pt(v: number) {
  return { magnitude: v, unit: 'PT' };
}
function box(pageObjectId: string, x: number, y: number, w: number, h: number) {
  return {
    pageObjectId,
    size: { width: emu(w), height: emu(h) },
    transform: { scaleX: 1, scaleY: 1, translateX: Math.round(x), translateY: Math.round(y), unit: 'EMU' },
  };
}
function textBox(id: string, pageObjectId: string, x: number, y: number, w: number, h: number, text: string, style: Record<string, unknown>, fields: string) {
  return [
    { createShape: { objectId: id, shapeType: 'TEXT_BOX', elementProperties: box(pageObjectId, x, y, w, h) } },
    { insertText: { objectId: id, insertionIndex: 0, text } },
    { updateTextStyle: { objectId: id, textRange: { type: 'ALL' }, style, fields } },
  ];
}

/** Pure: the batchUpdate requests that draw one weekly slide at the front of the deck. */
export function buildWeeklySlideRequests(i: WeeklySlideInput): Record<string, unknown>[] {
  const { slideId } = i;
  const margin = 0.4 * EMU_PER_INCH;
  const width = i.pageWidth - 2 * margin;
  const titleH = 0.55 * EMU_PER_INCH;
  const footerH = 0.3 * EMU_PER_INCH;
  const bodyTop = margin + titleH + 0.1 * EMU_PER_INCH;
  const bodyH = i.pageHeight - bodyTop - footerH - margin;

  const requests: Record<string, unknown>[] = [
    { createSlide: { objectId: slideId, insertionIndex: 0, slideLayoutReference: { predefinedLayout: 'BLANK' } } },
    ...textBox(
      `${slideId}_title`,
      slideId,
      margin,
      margin,
      width,
      titleH,
      `Active CLIF project runs · ${i.dateLabel}`,
      { bold: true, fontSize: pt(22), foregroundColor: { opaqueColor: { rgbColor: BURGUNDY } } },
      'bold,fontSize,foregroundColor',
    ),
  ];

  const shown = i.runs.slice(0, MAX_SLIDE_ROWS);
  const hidden = i.runs.length - shown.length;

  if (shown.length === 0) {
    requests.push(
      ...textBox(
        `${slideId}_empty`,
        slideId,
        margin,
        bodyTop,
        width,
        0.5 * EMU_PER_INCH,
        'No active or upcoming project runs this week.',
        { fontSize: pt(14), foregroundColor: { opaqueColor: { rgbColor: GRAY } } },
        'fontSize,foregroundColor',
      ),
    );
  } else {
    const tableId = `${slideId}_table`;
    const rows = shown.length + 1;
    const rowH = Math.min(0.32 * EMU_PER_INCH, bodyH / rows);
    requests.push({
      createTable: { objectId: tableId, elementProperties: box(slideId, margin, bodyTop, width, rowH * rows), rows, columns: HEADERS.length },
    });
    COLUMN_FRACTIONS.forEach((f, c) => {
      requests.push({
        updateTableColumnProperties: { objectId: tableId, columnIndices: [c], tableColumnProperties: { columnWidth: emu(width * f) }, fields: 'columnWidth' },
      });
    });
    requests.push({
      updateTableCellProperties: {
        objectId: tableId,
        tableRange: { location: { rowIndex: 0, columnIndex: 0 }, rowSpan: 1, columnSpan: HEADERS.length },
        tableCellProperties: { tableCellBackgroundFill: { solidFill: { color: { rgbColor: BURGUNDY } } } },
        fields: 'tableCellBackgroundFill.solidFill.color',
      },
    });

    const cells: string[][] = [
      HEADERS,
      ...shown.map((r) => [
        r.label || '—',
        r.conference ? `${r.title} · ${r.conference}` : r.title,
        r.status === 'open' ? 'Active' : 'Upcoming',
        deadlineCell(r),
        sitesCell(r),
        pendingCell(r),
      ]),
    ];
    cells.forEach((row, rowIndex) => {
      row.forEach((text, columnIndex) => {
        const cellLocation = { rowIndex, columnIndex };
        requests.push({ insertText: { objectId: tableId, cellLocation, insertionIndex: 0, text: text || '—' } });
        requests.push({
          updateTextStyle: {
            objectId: tableId,
            cellLocation,
            textRange: { type: 'ALL' },
            style:
              rowIndex === 0
                ? { bold: true, fontSize: pt(9), foregroundColor: { opaqueColor: { rgbColor: WHITE } } }
                : { fontSize: pt(9) },
            fields: rowIndex === 0 ? 'bold,fontSize,foregroundColor' : 'fontSize',
          },
        });
      });
    });
  }

  const footer =
    (hidden > 0 ? `+${hidden} more run${hidden === 1 ? '' : 's'} on the tracker. ` : '') +
    `Generated automatically every Thursday from ${i.trackerUrl}`;
  requests.push(
    ...textBox(
      `${slideId}_footer`,
      slideId,
      margin,
      i.pageHeight - margin - footerH,
      width,
      footerH,
      footer,
      { fontSize: pt(9), foregroundColor: { opaqueColor: { rgbColor: GRAY } } },
      'fontSize,foregroundColor',
    ),
  );
  return requests;
}

/** Active (open) runs by deadline, then upcoming runs, with site tallies that match the tracker and Slack reminders. */
export async function collectWeeklyRuns(now: Date = new Date()): Promise<WeeklyRunRow[]> {
  const db = getDb();
  const today = todayInConsortiumTz(now);
  const runsRes = await db.execute(
    `SELECT id, project_number, run_number, title, status, results_deadline, conference, created_at
     FROM project_runs WHERE status IN ('open', 'upcoming')
     ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,
              results_deadline IS NULL, results_deadline, project_number, run_number, created_at`,
  );
  const runs = runsRes.rows as any[];
  if (runs.length === 0) return [];

  const sitesRes = await db.execute('SELECT id, site_name FROM site_details ORDER BY site_name');
  const siteNames = new Map<string, string>(
    (sitesRes.rows as any[])
      .filter((s) => !SITES_NOT_YET_RUNNING.has(s.site_name as string))
      .map((s) => [s.id as string, s.site_name as string]),
  );
  const known = new Set(siteNames.keys());
  const placeholders = runs.map(() => '?').join(',');
  const statusRes = await db.execute({
    sql: `SELECT project_id, site_id, has_run, not_applicable FROM project_run_sites WHERE project_id IN (${placeholders})`,
    args: runs.map((r) => r.id as string),
  });
  const ran = new Map<string, Set<string>>();
  const na = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, pid: string, sid: string) => {
    if (!m.has(pid)) m.set(pid, new Set());
    m.get(pid)!.add(sid);
  };
  for (const s of statusRes.rows as any[]) {
    if (!known.has(s.site_id as string)) continue;
    if (Number(s.has_run) === 1) add(ran, s.project_id as string, s.site_id as string);
    else if (Number(s.not_applicable) === 1) add(na, s.project_id as string, s.site_id as string);
  }

  return runs.map((r) => {
    const id = r.id as string;
    const status = toProjectRunStatus(r.status) === 'upcoming' ? 'upcoming' : 'open';
    const deadline = (r.results_deadline as string) || null;
    const ranSet = ran.get(id) ?? new Set<string>();
    const naSet = na.get(id) ?? new Set<string>();
    return {
      label: runLabel(r.project_number, r.run_number),
      title: r.title as string,
      status,
      conference: (r.conference as string) || null,
      deadline,
      daysLeft: deadline ? daysBetween(today, deadline) : null,
      ran: status === 'open' ? ranSet.size : null,
      applicable: status === 'open' ? known.size - naSet.size : null,
      pending:
        status === 'open'
          ? [...siteNames].filter(([sid]) => !ranSet.has(sid) && !naSet.has(sid)).map(([, name]) => name)
          : [],
    };
  });
}

export interface WeeklySlideOutcome {
  today: string;
  slideId: string;
  created: boolean;
  runs: number;
}

/** Insert this week's slide at the front of the deck. No-op if this week already has one. */
export async function insertWeeklyRunSlide(origin: string, now: Date = new Date()): Promise<WeeklySlideOutcome> {
  const presentationId = process.env.WEEKLY_SLIDE_PRESENTATION_ID || import.meta.env.WEEKLY_SLIDE_PRESENTATION_ID;
  if (!presentationId) throw new Error('WEEKLY_SLIDE_PRESENTATION_ID is not configured');
  const key = parseServiceAccountKey(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || import.meta.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const token = await getServiceAccountAccessToken(key, [SLIDES_SCOPE]);
  const base = `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const deckRes = await fetch(`${base}?fields=pageSize,slides.objectId`, { headers });
  const deck = (await deckRes.json().catch(() => ({}))) as any;
  if (!deckRes.ok) throw new Error(`Slides API read failed (${deckRes.status}): ${deck?.error?.message || 'unknown error'}`);

  const today = todayInConsortiumTz(now);
  const slideId = weeklySlideObjectId(today);
  const existing: string[] = (deck.slides ?? []).map((s: any) => s.objectId as string);
  const runs = await collectWeeklyRuns(now);
  if (existing.includes(slideId)) return { today, slideId, created: false, runs: runs.length };

  const requests = buildWeeklySlideRequests({
    slideId,
    pageWidth: Number(deck.pageSize?.width?.magnitude) || 9144000,
    pageHeight: Number(deck.pageSize?.height?.magnitude) || 5143500,
    dateLabel: longDateLabel(today),
    runs,
    trackerUrl: `${origin}/portal/project-runs`,
  });
  const upd = await fetch(`${base}:batchUpdate`, { method: 'POST', headers, body: JSON.stringify({ requests }) });
  if (!upd.ok) {
    const err = (await upd.json().catch(() => ({}))) as any;
    throw new Error(`Slides API update failed (${upd.status}): ${err?.error?.message || 'unknown error'}`);
  }
  return { today, slideId, created: true, runs: runs.length };
}
