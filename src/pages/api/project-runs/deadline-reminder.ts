export const prerender = false;

import type { APIRoute } from 'astro';
import { sendDeadlineReminders } from '../../../lib/project-run-reminders';

/**
 * Deadline reminder job. Invoked daily by Vercel Cron (see vercel.json) at
 * 14:00 UTC -- 09:00 Chicago in summer, 08:00 in winter -- so the post lands
 * at the start of the consortium's working day rather than overnight.
 *
 * Posts to #run_requests when an open run's Box upload deadline comes within
 * a week, and again when it comes within a day: how many sites have run it
 * and which are still pending. See src/lib/project-run-reminders.ts for the
 * once-per-window rule. With SLACK_WEBHOOK_URL unset nothing is posted or
 * recorded.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. The request is
 * rejected unless CRON_SECRET is configured and matches.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const secret = process.env.CRON_SECRET || import.meta.env.CRON_SECRET;
  if (!secret) {
    return json({ error: 'CRON_SECRET not configured' }, 500);
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // The "View in portal" link must point at the public site even when the
  // job is triggered through a preview or a local server.
  const result = await sendDeadlineReminders(import.meta.env.SITE || url.origin);
  const posted = result.reminders.filter((r) => r.posted);
  if (posted.length > 0) {
    console.log(`[deadline-reminder] posted ${posted.length} reminder(s)`, posted);
  }
  const failed = result.reminders.filter((r) => r.error);
  if (failed.length > 0) {
    console.error(`[deadline-reminder] ${failed.length} reminder(s) failed`, failed);
  }

  return json({ success: true, ...result });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
