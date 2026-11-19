export const prerender = false;

import type { APIRoute } from 'astro';
import { buildMirrorSkipReportEmail, sendEmail } from '../../../lib/email';
import {
  MIRROR_REPORT_EMAIL,
  isMirrorSyncAuthorized,
  parseMirrorResults,
  recordMirrorResults,
} from '../../../lib/project-run-mirror';

/**
 * Results of the weekly repo-mirror job (see /api/project-runs/mirror-queue).
 * Body: `{ results: [{ id?, title, repo_url, outcome, mirror_url?, reason? }] }`.
 *
 * Mirrored and already-in-org runs get their org link recorded, which takes
 * them out of the queue for good. Skipped runs keep their place in the queue,
 * and the skips that are new (or whose reason changed) are emailed to the
 * consortium inbox, so the same skip is not reported every week.
 *
 * Auth: `Authorization: Bearer <MIRROR_SYNC_TOKEN>`.
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = process.env.MIRROR_SYNC_TOKEN || import.meta.env.MIRROR_SYNC_TOKEN;
  if (!secret) return json({ error: 'MIRROR_SYNC_TOKEN not configured' }, 500);
  if (!isMirrorSyncAuthorized(request.headers.get('authorization'), secret)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const parsed = parseMirrorResults(await request.json().catch(() => null));
  if ('error' in parsed) return json({ error: parsed.error }, 400);

  const { recorded, skipsToReport } = await recordMirrorResults(parsed.results);

  let emailed = false;
  if (skipsToReport.length > 0) {
    const n = skipsToReport.length;
    const sent = await sendEmail(
      MIRROR_REPORT_EMAIL,
      `CLIF repo mirror: ${n} project ${n === 1 ? 'repo' : 'repos'} skipped`,
      buildMirrorSkipReportEmail(skipsToReport),
    );
    emailed = sent.ok;
    if (!sent.ok) console.error('[mirror-results] skip report email failed:', sent.error);
  }
  console.log(`[mirror-results] recorded ${recorded}, reported ${skipsToReport.length} skip(s)`);
  return json({ success: true, recorded, skipsReported: skipsToReport.length, emailed });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
