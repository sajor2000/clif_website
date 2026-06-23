import { getDb } from './turso';
import { sendEmail, buildProposalNotificationEmail } from './email';
import { loginEmailsByUser } from './recipient-emails';

/**
 * Email the "new proposal awaiting your vote" notification to eligible voters.
 * Audience is always steering committee + admins (approved users only).
 *
 * @param proposalId  the proposal to notify about
 * @param origin      site origin (e.g. https://clif-icu.com) for building the link
 * @param opts.onlyNonVoters  when true, skip members who have already voted
 * @param opts.excludeUserId  optional user id to skip (e.g. the proposal's creator)
 * @returns the number of recipients emailed
 */
export async function notifyProposalOpened(
  proposalId: string,
  origin: string,
  opts: { onlyNonVoters?: boolean; excludeUserId?: string } = {},
): Promise<{ sent: number; error?: string }> {
  const db = getDb();

  const proposalRes = await db.execute({
    sql: 'SELECT id, title, description, deadline, status FROM proposals WHERE id = ?',
    args: [proposalId],
  });
  if (proposalRes.rows.length === 0) {
    return { sent: 0, error: 'Proposal not found' };
  }
  const p = proposalRes.rows[0];

  // Eligible voters: approved steering committee members + admins
  const recipientsRes = await db.execute({
    sql: `SELECT id, email FROM users
          WHERE is_approved = 1
            AND role IN ('steering', 'admin')
            AND email IS NOT NULL`,
    args: [],
  });

  let recipients = recipientsRes.rows.map((r) => ({
    id: r.id as string,
    email: r.email as string,
  }));

  if (opts.excludeUserId) {
    recipients = recipients.filter((r) => r.id !== opts.excludeUserId);
  }

  if (opts.onlyNonVoters) {
    const votedRes = await db.execute({
      sql: 'SELECT user_id FROM votes WHERE proposal_id = ?',
      args: [proposalId],
    });
    const voted = new Set(votedRes.rows.map((r) => r.user_id as string));
    recipients = recipients.filter((r) => !voted.has(r.id));
  }

  const votingUrl = `${origin}/portal/voting`;
  const html = buildProposalNotificationEmail(
    p.title as string,
    (p.description as string) || null,
    (p.deadline as string) || '',
    votingUrl,
  );
  const subject = `New CLIF proposal awaiting your vote: ${p.title as string}`;

  // Reach each member at every email they sign in with, not just the primary.
  const emailMap = await loginEmailsByUser(recipients.map((r) => r.id));
  const sends: Promise<unknown>[] = [];
  for (const r of recipients) {
    for (const addr of emailMap.get(r.id) ?? [r.email]) {
      sends.push(
        sendEmail(addr, subject, html).catch(() => {
          /* fire-and-forget; don't fail the request on a single bad address */
        }),
      );
    }
  }
  await Promise.all(sends);

  return { sent: recipients.length };
}
