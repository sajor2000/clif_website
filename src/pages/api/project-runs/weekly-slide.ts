export const prerender = false;

import type { APIRoute } from 'astro';
import { collectWeeklyRuns, insertWeeklyRunSlide } from '../../../lib/weekly-run-slide';

/**
 * Weekly project-run slide. Invoked by Vercel Cron (see vercel.json) every
 * Wednesday at 11:00 UTC, which is early morning in Chicago year-round, and
 * inserts a summary of active/upcoming runs as the first slide of the standing
 * meeting deck (see src/lib/weekly-run-slide.ts).
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` from Vercel Cron, or a signed-in
 * admin visiting the URL to generate this week's slide by hand. Running it
 * twice on one day is safe: the second call finds today's slide and does
 * nothing. `?dry=1` returns the rows that would be drawn without touching the
 * deck or needing Google credentials.
 */
export const GET: APIRoute = async ({ request, locals, url }) => {
  const secret = process.env.CRON_SECRET || import.meta.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  const viaCron = Boolean(secret) && auth === `Bearer ${secret}`;
  const viaAdmin = locals.user?.role === 'admin';
  if (!viaCron && !viaAdmin) return json({ error: 'Unauthorized' }, 401);

  try {
    if (url.searchParams.get('dry') === '1') {
      return json({ success: true, dry: true, runs: await collectWeeklyRuns() });
    }
    const outcome = await insertWeeklyRunSlide(url.origin);
    console.log(`[weekly-slide] ${outcome.created ? 'created' : 'already had'} ${outcome.slideId} (${outcome.runs} runs)`);
    return json({ success: true, ...outcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[weekly-slide] failed:', message);
    return json({ success: false, error: message }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
