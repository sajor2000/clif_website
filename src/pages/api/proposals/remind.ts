export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { sendEmail, buildProposalReminderEmail } from '../../../lib/email';
import { loginEmailsByUser } from '../../../lib/recipient-emails';

/**
 * Deadline reminder job. Intended to be invoked daily by Vercel Cron.
 *
 * For every open proposal whose deadline is within the next 2 days, emails the
 * steering committee + admins who have NOT yet voted and have not already been
 * reminded for that proposal. Each member is reminded at most once per proposal
 * (tracked in proposal_reminders).
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

  const db = getDb();

  // Open proposals whose deadline is today through 2 days out (not yet passed).
  const proposalsRes = await db.execute({
    sql: `SELECT id, title, deadline FROM proposals
          WHERE status = 'open'
            AND deadline IS NOT NULL
            AND date(deadline) >= date('now')
            AND date(deadline) <= date('now', '+2 day')`,
    args: [],
  });

  const votingUrl = `${url.origin}/portal/voting`;
  let totalSent = 0;
  const perProposal: Array<{ id: string; title: string; sent: number }> = [];

  for (const p of proposalsRes.rows) {
    const proposalId = p.id as string;

    // Steering + admins who are approved, haven't voted, and haven't been reminded.
    const recipientsRes = await db.execute({
      sql: `SELECT u.id, u.email FROM users u
            WHERE u.is_approved = 1
              AND u.role IN ('steering', 'admin')
              AND u.email IS NOT NULL
              AND u.id NOT IN (SELECT user_id FROM votes WHERE proposal_id = ?)
              AND u.id NOT IN (SELECT user_id FROM proposal_reminders WHERE proposal_id = ?)`,
      args: [proposalId, proposalId],
    });

    const html = buildProposalReminderEmail(p.title as string, (p.deadline as string) || '', votingUrl);
    const subject = `Reminder: vote needed on CLIF proposal "${p.title as string}"`;

    const ids = recipientsRes.rows.map((r) => r.id as string);
    const emailMap = await loginEmailsByUser(ids);

    let sent = 0;
    for (const r of recipientsRes.rows) {
      const id = r.id as string;
      const addrs = emailMap.get(id) ?? [r.email as string];
      // Send to every linked address; one success is enough to mark reminded.
      let anyOk = false;
      for (const addr of addrs) {
        const result = await sendEmail(addr, subject, html);
        if (result.ok) anyOk = true;
      }
      if (anyOk) {
        // Record the reminder so this member isn't emailed again for this proposal.
        await db.execute({
          sql: 'INSERT OR IGNORE INTO proposal_reminders (proposal_id, user_id) VALUES (?, ?)',
          args: [proposalId, id],
        });
        sent++;
      }
    }

    totalSent += sent;
    perProposal.push({ id: proposalId, title: p.title as string, sent });
  }

  return json({ success: true, totalSent, proposals: perProposal });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
