export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import {
  buildExportSheets,
  exportFilename,
  toExportFilter,
  type ExportRun,
  type ExportSite,
  type ExportSiteStatus,
} from '../../../lib/project-run-export';
import { buildXlsx } from '../../../lib/xlsx';

/**
 * Download the project-run tracker as an Excel workbook.
 *
 * GET /api/project-runs/export?filter=active|upcoming|ats|all (default active;
 * the same sets as the tabs on /portal/project-runs). Any approved member can
 * download it, which matches who can see the tracker.
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.user;
  if (!user || !user.is_approved) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const filter = toExportFilter(url.searchParams.get('filter'));
  const db = getDb();
  const [runsResult, sitesResult, statusResult] = await Promise.all([
    db.execute(
      // Same order as the tracker: the number members see on the card, newest first.
      `SELECT p.*, u.full_name AS creator_name
         FROM project_runs p
         LEFT JOIN users u ON p.created_by = u.id
        ORDER BY p.project_number IS NULL, p.project_number DESC, p.created_at DESC`,
    ),
    db.execute('SELECT id, site_name FROM site_details ORDER BY site_name'),
    db.execute(
      'SELECT project_id, site_id, has_run, not_applicable, na_reason FROM project_run_sites WHERE has_run = 1 OR not_applicable = 1',
    ),
  ]);

  const now = new Date();
  const sheets = buildExportSheets(
    runsResult.rows as unknown as ExportRun[],
    sitesResult.rows as unknown as ExportSite[],
    statusResult.rows as unknown as ExportSiteStatus[],
    filter,
    now,
  );
  const body = buildXlsx(sheets);

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${exportFilename(filter, now)}"`,
      'Cache-Control': 'no-store',
    },
  });
};
