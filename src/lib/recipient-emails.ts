import { getDb } from './turso';

/**
 * Every distinct address a member can be reached at: their primary
 * `users.email` plus every linked login identity (`user_identities.email`),
 * deduplicated case-insensitively. Used so notifications reach a member at all
 * the addresses they sign in with, not just the primary one.
 *
 * @param userIds  member ids to resolve
 * @returns map of user id -> list of distinct emails (order: primary-ish first)
 */
export async function loginEmailsByUser(userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;

  const db = getDb();
  const placeholders = userIds.map(() => '?').join(', ');
  const res = await db.execute({
    sql: `SELECT id AS uid, email FROM users WHERE id IN (${placeholders})
          UNION
          SELECT user_id AS uid, email FROM user_identities WHERE user_id IN (${placeholders})`,
    args: [...userIds, ...userIds],
  });

  for (const row of res.rows) {
    const uid = row.uid as string;
    const email = String(row.email ?? '').trim();
    if (!email) continue;
    const list = map.get(uid) ?? [];
    if (!list.some((e) => e.toLowerCase() === email.toLowerCase())) {
      list.push(email);
      map.set(uid, list);
    }
  }
  return map;
}

/** Convenience wrapper for a single member. */
export async function loginEmailsForUser(userId: string): Promise<string[]> {
  const map = await loginEmailsByUser([userId]);
  return map.get(userId) ?? [];
}
