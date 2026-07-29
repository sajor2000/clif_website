import { getDb } from './turso';
import { sendEmail } from './email';
import { loginEmailsByUser } from './recipient-emails';

/**
 * Stored, discrete-event notifications for members (the header bell + the
 * /portal/notifications inbox). Standing obligations are derived separately in
 * ./tasks — this module only handles events that "happened" and their per-user
 * read state.
 */

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  actor_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationInput {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
}

/** Optional email side-channel for a fan-out. */
export interface EmailPayload {
  subject: string;
  html: string;
}

/**
 * Insert one in-app notification for a single recipient. Returns the new id, or
 * null on failure (callers treat notifications as best-effort).
 */
export async function createNotification(
  userId: string,
  n: NotificationInput,
): Promise<string | null> {
  const db = getDb();
  try {
    const res = await db.execute({
      sql: `INSERT INTO notifications
              (user_id, type, title, body, link, entity_type, entity_id, actor_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id`,
      args: [
        userId,
        n.type,
        n.title,
        n.body ?? null,
        n.link ?? null,
        n.entityType ?? null,
        n.entityId ?? null,
        n.actorId ?? null,
      ],
    });
    return (res.rows[0]?.id as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Deliver the same notification to many recipients at once (in-app rows), and
 * optionally email each of them at every address they sign in with. The actor
 * is never notified about their own action. Fire-and-forget friendly: a bad
 * address or a single failed insert never rejects the batch.
 *
 * @returns the number of distinct users notified in-app
 */
export async function fanOutNotification(
  userIds: string[],
  n: NotificationInput,
  email?: EmailPayload,
): Promise<number> {
  const recipients = Array.from(new Set(userIds)).filter(
    (id) => id && id !== n.actorId,
  );
  if (recipients.length === 0) return 0;

  // In-app rows — one per recipient.
  await Promise.all(recipients.map((id) => createNotification(id, n)));

  // Optional email — reach each member at all of their linked addresses.
  if (email) {
    const emailMap = await loginEmailsByUser(recipients);
    const sends: Promise<unknown>[] = [];
    for (const id of recipients) {
      for (const addr of emailMap.get(id) ?? []) {
        sends.push(
          sendEmail(addr, email.subject, email.html).catch(() => {
            /* one bad address shouldn't fail the batch */
          }),
        );
      }
    }
    await Promise.all(sends);
  }

  return recipients.length;
}

/** Count a member's unread notifications (for the bell badge). */
export async function unreadCount(userId: string): Promise<number> {
  const db = getDb();
  try {
    const res = await db.execute({
      sql: 'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND read_at IS NULL',
      args: [userId],
    });
    return Number(res.rows[0]?.cnt) || 0;
  } catch {
    return 0;
  }
}

/** A member's most recent notifications, newest first. */
export async function listNotifications(
  userId: string,
  limit = 30,
): Promise<NotificationRow[]> {
  const db = getDb();
  try {
    const res = await db.execute({
      sql: `SELECT id, type, title, body, link, entity_type, entity_id, actor_id, read_at, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?`,
      args: [userId, limit],
    });
    return res.rows as unknown as NotificationRow[];
  } catch {
    return [];
  }
}

/** Mark a single notification read (scoped to its owner). */
export async function markRead(userId: string, id: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL',
    args: [new Date().toISOString(), id, userId],
  });
}

/** Mark all of a member's notifications read. */
export async function markAllRead(userId: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL',
    args: [new Date().toISOString(), userId],
  });
}
