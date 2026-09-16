import { getDb } from './turso';
import { sendEmail, buildProjectRunNotificationEmail } from './email';
import { loginEmailsByUser } from './recipient-emails';
import { createNotification } from './notifications';
import { notifySlackProjectRun } from './slack';

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

  // In-app notification for the bell/inbox — one per recipient, best-effort.
  const title = p.title as string;
  const inApp = recipients.map((r) =>
    createNotification(r.id, {
      type: 'project_run.created',
      title: `New project run ready: ${title}`,
      body: (p.description as string) || null,
      link: projectUrl,
      entityType: 'project_run',
      entityId: projectId,
      actorId: opts.excludeUserId ?? null,
    }),
  );

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
  await Promise.all([...inApp, ...sends]);

  return { sent: recipients.length };
}

/**
 * Announce a run that sites can now act on: a Slack post to #run_requests
 * always, plus the all-members email when the requester asked for it. Called
 * when an open run is created and when an upcoming run launches. Callers don't
 * await it — a mail or Slack hiccup must never fail the request.
 */
export async function announceProjectRun(
  projectId: string,
  opts: { origin: string; notifyAll: boolean; requester: { id: string; full_name?: string | null; email?: string | null } },
): Promise<void> {
  const { origin, notifyAll, requester } = opts;
  if (notifyAll) {
    notifyProjectRunReady(projectId, origin, { excludeUserId: requester.id }).catch(() => {});
  }

  // A channel post is opt-in to read, unlike mailing all approved members, so
  // it goes out regardless of notifyAll. No-ops when SLACK_WEBHOOK_URL is unset.
  const res = await getDb().execute({
    sql: `SELECT project_number, title, description, purpose, purpose_detail, results_deadline, conference
          FROM project_runs WHERE id = ?`,
    args: [projectId],
  });
  const r = res.rows[0];
  if (!r) return;
  await notifySlackProjectRun({
    projectNumber: r.project_number == null ? null : Number(r.project_number),
    title: r.title as string,
    description: (r.description as string) || null,
    purpose: (r.purpose as string) || null,
    purposeDetail: (r.purpose_detail as string) || null,
    deadline: (r.results_deadline as string) || null,
    conference: (r.conference as string) || null,
    requestedBy: requester.full_name || requester.email || null,
    projectUrl: `${origin}/portal/project-runs`,
  });
}
