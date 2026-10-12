import { describe, expect, it } from 'vitest';
import {
  buildExportSheets,
  exportFilename,
  matchesExportFilter,
  toExportFilter,
  type ExportRun,
} from './project-run-export';
import { buildXlsx, columnRef } from './xlsx';
import { CURRENT_ATS } from './project-run-status';

// 2026-10-12 noon in Chicago. Deadlines are Chicago calendar dates due at end of day.
const now = new Date('2026-10-12T17:00:00Z');

const sites = [
  { id: 's1', site_name: 'Emory' },
  { id: 's2', site_name: 'Rush' },
  { id: 's3', site_name: 'UChicago' },
];

const runs: ExportRun[] = [
  {
    id: 'p1',
    project_number: 3,
    title: 'Open, deadline ahead',
    status: 'open',
    results_deadline: '2026-10-30',
    purpose: 'conference',
    purpose_detail: CURRENT_ATS,
    conference: CURRENT_ATS,
    clif_version: '2.1',
    required_tables: '["labs","vitals"]',
    prelim_shared: 1,
    prelim_link: 'https://example.org/prelim',
    creator_name: 'Tester',
    created_at: '2026-09-01 14:03:00',
  },
  { id: 'p2', project_number: 2, title: 'Open, deadline passed', status: 'open', results_deadline: '2026-10-11' },
  { id: 'p3', project_number: 1, title: 'Upcoming', status: 'upcoming', conference: CURRENT_ATS },
  { id: 'p4', project_number: null, title: 'Closed', status: 'closed', results_deadline: '2026-01-01' },
];

const statuses = [
  { project_id: 'p1', site_id: 's1', has_run: 1, not_applicable: 0, na_reason: null },
  { project_id: 'p1', site_id: 's2', has_run: 0, not_applicable: 1, na_reason: 'No ECMO program' },
  { project_id: 'p2', site_id: 's3', has_run: 0, not_applicable: 1, na_reason: '' },
];

describe('matchesExportFilter', () => {
  it('active = open and deadline today or later', () => {
    expect(runs.filter((r) => matchesExportFilter(r, 'active', now)).map((r) => r.id)).toEqual(['p1']);
  });
  it('a deadline due today is still active', () => {
    expect(matchesExportFilter({ id: 'x', title: 't', status: 'open', results_deadline: '2026-10-12' }, 'active', now)).toBe(true);
  });
  it('upcoming, ats and all match the tracker tabs', () => {
    expect(runs.filter((r) => matchesExportFilter(r, 'upcoming', now)).map((r) => r.id)).toEqual(['p3']);
    expect(runs.filter((r) => matchesExportFilter(r, 'ats', now)).map((r) => r.id)).toEqual(['p1', 'p3']);
    expect(runs.filter((r) => matchesExportFilter(r, 'all', now)).map((r) => r.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });
  it('unknown filters fall back to active', () => {
    expect(toExportFilter('bogus')).toBe('active');
    expect(toExportFilter(null)).toBe('active');
    expect(toExportFilter('all')).toBe('all');
  });
});

describe('buildExportSheets', () => {
  it('writes one run row with site counts and labels', () => {
    const [runsSheet, siteSheet] = buildExportSheets(runs, sites, statuses, 'active', now);
    expect(runsSheet.name).toBe('Runs');
    expect(runsSheet.rows).toHaveLength(2);
    const header = runsSheet.rows[0] as string[];
    const row = Object.fromEntries(header.map((h, i) => [h, runsSheet.rows[1][i]]));
    expect(row).toMatchObject({
      '#': 3,
      Title: 'Open, deadline ahead',
      Status: 'Active',
      Conference: CURRENT_ATS,
      Purpose: 'Conference / Abstract',
      'CLIF version': '2.1',
      'Required tables': 'labs, vitals',
      'Sites run': 1,
      'Sites applicable': 2,
      'Sites N/A': 1,
      'Box upload deadline': '2026-10-30',
      'Deadline passed': 'No',
      'Prelim results shared': 'Yes',
      'Prelim results link': 'https://example.org/prelim',
      'Requested by': 'Tester',
      'Requested on': '2026-09-01',
    });
    expect(siteSheet.rows[0]).toEqual(['#', 'Title', 'Status', 'Emory', 'Rush', 'UChicago']);
    expect(siteSheet.rows[1]).toEqual([3, 'Open, deadline ahead', 'Active', 'Run', 'N/A: No ECMO program', null]);
  });

  it('leaves site cells and counts blank for runs that have not launched', () => {
    const [runsSheet, siteSheet] = buildExportSheets(runs, sites, statuses, 'all', now);
    const upcoming = runsSheet.rows.find((r) => r[1] === 'Upcoming')!;
    expect(upcoming.slice(8, 11)).toEqual([null, null, null]);
    expect(siteSheet.rows.find((r) => r[1] === 'Upcoming')!.slice(3)).toEqual([null, null, null]);
    const passed = runsSheet.rows.find((r) => r[1] === 'Open, deadline passed')!;
    expect(passed[12]).toBe('Yes');
    expect(siteSheet.rows.find((r) => r[1] === 'Open, deadline passed')!.slice(3)).toEqual([null, null, 'N/A']);
  });

  it('names the file by filter and Chicago date', () => {
    expect(exportFilename('active', now)).toBe('clif-project-runs-active-2026-10-12.xlsx');
  });
});

describe('buildXlsx', () => {
  it('produces a zip with the workbook parts', () => {
    const buf = buildXlsx(buildExportSheets(runs, sites, statuses, 'all', now));
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const text = buf.toString('latin1');
    for (const part of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
      expect(text).toContain(part);
    }
    // End-of-central-directory record closes the archive.
    expect(buf.readUInt32LE(buf.length - 22)).toBe(0x06054b50);
  });
  it('maps column indexes to letters', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnRef)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });
});
