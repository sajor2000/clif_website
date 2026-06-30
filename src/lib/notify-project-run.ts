import { getDb } from './turso';
import { sendEmail, buildProjectRunNotificationEmail } from './email';
import { loginEmailsByUser } from './recipient-emails';

/**
 * Email the "a new project run is ready" notification to every approved
 * consortium member. Triggered explicitly by the request creator (or an admin),
 * either at create time via the "notify all members" option or later via the
 * "Notify members" button on a request.
 *
 * @param projectId       the project run to notify about
 * @param origin          site origin (e.g. https://clif-icu.com) for the link
 * @param opts.excludeUserId  optional user id to skip (typically the creator)
 * @returns the number of members emailed
 */
export async function notifyProjectRunReady(
  projectId: string,
  origin: string,
  opts: { excludeUserId?: string } = {},
): Promise<{ sent: number; error?: string }> {
  const db = getDb();

  const runRes = await db.execute({
    sql: 'SELECT id, title, description, instructions, results_deadline FROM project_runs WHERE id = ?',
    args: [projectId],
  });
  if (runRes.rows.length === 0) {
    return { sent: 0, error: 'Project run not found' };
  }
  const p = runRes.rows[0];

  // Audience: every approved member with an email address.
  const recipientsRes = await db.execute({
    sql: `SELECT id, email FROM users WHERE is_approved = 1 AND email IS NOT NULL`,
    args: [],
  });

  let recipients = recipientsRes.rows.map((r) => ({
    id: r.id as string,
    email: r.email as string,
  }));

  if (opts.excludeUserId) {
    recipients = recipients.filter((r) => r.id !== opts.excludeUserId);
  }

  const projectUrl = `${origin}/portal/project-runs`;
  const html = buildProjectRunNotificationEmail(
    p.title as string,
    (p.description as string) || null,
    (p.instructions as string) || null,
    (p.results_deadline as string) || null,
    projectUrl,
  );
  const subject = `New CLIF project run ready: ${p.title as string}`;

  // Reach each member at every address they sign in with, not just the primary.
  const emailMap = await loginEmailsByUser(recipients.map((r) => r.id));
  const sends: Promise<unknown>[] = [];
  for (const r of recipients) {
    for (const addr of emailMap.get(r.id) ?? [r.email]) {
      sends.push(
        sendEmail(addr, subject, html).catch(() => {
          /* fire-and-forget; one bad address shouldn't fail the batch */
        }),
      );
    }
  }
  await Promise.all(sends);

  return { sent: recipients.length };
}
