import { getDb } from './turso';
import { sendEmail, buildLosApprovalEmail } from './email';
import { loginEmailsByUser } from './recipient-emails';
import { createNotification } from './notifications';
import { generateApprovalToken } from './los-approvals';

/**
 * Ask every site PI to approve a newly filed letter of collaboration.
 *
 * Creates one `los_approvals` row per flagged PI (skipping any that already
 * exist, so re-running after new PIs are flagged only reaches the newcomers),
 * emails each PI their personal one-click Approve / Decline links at every
 * address they sign in with, and drops an in-app notification.
 *
 * @returns how many PIs were emailed (0 when nobody is flagged)
 */
export async function notifyLosRequestOpened(
  requestId: string,
  origin: string,
): Promise<{ sent: number; error?: string }> {
  const db = getDb();

  const reqRes = await db.execute({
    sql: `SELECT r.id, r.grant_title, r.grant_type, r.grant_deadline, r.aims_link, r.los_link,
                 r.created_by, u.full_name AS requester_name, u.email AS requester_email
          FROM los_requests r
          LEFT JOIN users u ON u.id = r.created_by
          WHERE r.id = ?`,
    args: [requestId],
  });
  if (reqRes.rows.length === 0) return { sent: 0, error: 'Request not found' };
  const r = reqRes.rows[0];

  const pisRes = await db.execute({
    sql: `SELECT id FROM users WHERE is_approved = 1 AND is_site_pi = 1`,
    args: [],
  });
  const piIds = pisRes.rows.map((row) => row.id as string);
  if (piIds.length === 0) return { sent: 0 };

  // Only PIs who do not already have a row for this request get a new token.
  const existingRes = await db.execute({
    sql: `SELECT user_id FROM los_approvals WHERE request_id = ? AND user_id IS NOT NULL`,
    args: [requestId],
  });
  const already = new Set(existingRes.rows.map((row) => row.user_id as string));
  const newPis = piIds.filter((id) => !already.has(id));
  if (newPis.length === 0) return { sent: 0 };

  const now = new Date().toISOString();
  const tokens = new Map<string, string>();
  for (const uid of newPis) {
    const token = generateApprovalToken();
    tokens.set(uid, token);
    await db.execute({
      sql: `INSERT OR IGNORE INTO los_approvals (request_id, user_id, token, emailed_at) VALUES (?, ?, ?, ?)`,
      args: [requestId, uid, token, now],
    });
  }

  const requesterName =
    (r.requester_name as string | null) || (r.requester_email as string | null) || 'A CLIF member';
  const trackerUrl = `${origin}/portal/los-requests`;
  const subject = `Approval needed: letter of collaboration for ${r.grant_title as string}`;

  const emailMap = await loginEmailsByUser(newPis);
  const sends: Promise<unknown>[] = [];
  for (const uid of newPis) {
    const token = tokens.get(uid)!;
    const html = buildLosApprovalEmail({
      grantTitle: r.grant_title as string,
      grantType: (r.grant_type as string | null) || null,
      grantDeadline: (r.grant_deadline as string | null) || null,
      requesterName,
      aimsLink: (r.aims_link as string | null) || null,
      losLink: (r.los_link as string | null) || null,
      approveUrl: `${origin}/api/los-requests/respond?token=${token}&action=approve`,
      declineUrl: `${origin}/api/los-requests/respond?token=${token}&action=decline`,
      trackerUrl,
    });
    for (const addr of emailMap.get(uid) ?? []) {
      sends.push(
        sendEmail(addr, subject, html).catch(() => {
          /* one bad address shouldn't fail the batch */
        }),
      );
    }
    sends.push(
      createNotification(uid, {
        type: 'los_approval_requested',
        title: `Approve letter of collaboration: ${r.grant_title as string}`,
        body: `Requested by ${requesterName}`,
        link: '/portal/los-requests',
        entityType: 'los_request',
        entityId: requestId,
        actorId: (r.created_by as string) || null,
      }),
    );
  }
  await Promise.all(sends);

  return { sent: newPis.length };
}
