export const prerender = false;

import type { APIRoute } from 'astro';
import { collectMirrorQueue, isMirrorSyncAuthorized } from '../../../lib/project-run-mirror';

/**
 * Queue for the weekly repo-mirror job: closed project runs that have a repo
 * link and no copy in the CLIF GitHub org yet. Read by the GitHub Action in
 * Common-Longitudinal-ICU-data-Format/.github, which does the copying and
 * reports back to /api/project-runs/mirror-results.
 *
 * Auth: `Authorization: Bearer <MIRROR_SYNC_TOKEN>`. This is its own secret
 * (not CRON_SECRET) because it is handed to GitHub Actions.
 */
export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.MIRROR_SYNC_TOKEN || import.meta.env.MIRROR_SYNC_TOKEN;
  if (!secret) return json({ error: 'MIRROR_SYNC_TOKEN not configured' }, 500);
  if (!isMirrorSyncAuthorized(request.headers.get('authorization'), secret)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  return json({ success: true, runs: await collectMirrorQueue() });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
