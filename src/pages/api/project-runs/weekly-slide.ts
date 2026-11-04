export const prerender = false;

import type { APIRoute } from 'astro';
import { hourInConsortiumTz } from '../../../lib/project-run-deadline';
import { collectWeeklyRuns, insertWeeklyRunSlide } from '../../../lib/weekly-run-slide';

/**
 * Weekly project-run slide: a summary of active/upcoming runs inserted as the
 * first slide of the standing meeting deck (see src/lib/weekly-run-slide.ts)
 * every Thursday at 9:00 Chicago time.
 *
 * Vercel Cron only speaks UTC, and 9am Chicago is 14:00 UTC in summer and
 * 15:00 UTC in winter, so vercel.json fires this route at both hours every
 * Thursday and the cron path below only acts when it is actually 9 o'clock in
 * Chicago. (The other call of the day is a no-op either way, because today's
 * slide already exists.)
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` from Vercel Cron, or a signed-in
 * admin visiting the URL to generate this week's slide by hand. One slide per
 * week, whoever asks first: a later call in the same week finds it and does
 * nothing. `?dry=1` returns the rows that would be drawn without touching the
 * deck or needing Google credentials.
 */
export const GET: APIRoute = async ({ request, locals, url }) => {
  const secret = process.env.CRON_SECRET || import.meta.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  const viaCron = Boolean(secret) && auth === `Bearer ${secret}`;
  const viaAdmin = locals.user?.role === 'admin';
  if (!viaCron && !viaAdmin) return json({ error: 'Unauthorized' }, 401);

  const SLIDE_HOUR_CHICAGO = 9;
  if (viaCron && !viaAdmin && hourInConsortiumTz() !== SLIDE_HOUR_CHICAGO) {
    return json({ success: true, skipped: true, reason: `not ${SLIDE_HOUR_CHICAGO}:00 in Chicago` });
  }

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
