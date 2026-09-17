import { getDb } from './turso';

/** A foreign key column somewhere in the schema that points at users(id). */
type UserRef = {
  table: string;
  column: string;
  /** True when the column is NOT NULL, so the row must go before the user can. */
  required: boolean;
};

export type DeleteUserResult =
  | { ok: true }
  | { ok: false; blockedBy: Array<{ table: string; column: string; count: number }> };

let refCache: UserRef[] | null = null;

/**
 * Every FK column referencing users(id) that does NOT cascade. Cascading columns
 * (sessions, notifications, user_identities, …) clean themselves up on DELETE;
 * these are the ones that make the DELETE fail. Introspected once per process so
 * new migrations are picked up without touching this file.
 */
async function getUserRefs(): Promise<UserRef[]> {
  if (refCache) return refCache;

  const db = getDb();
  const { rows: tables } = await db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  );

  const refs: UserRef[] = [];
  for (const t of tables) {
    const table = String(t.name);
    const { rows: fks } = await db.execute(`PRAGMA foreign_key_list("${table}")`);
    const pointingAtUsers = fks.filter(
      (fk) => String(fk.table) === 'users' && String(fk.on_delete).toUpperCase() !== 'CASCADE'
    );
    if (pointingAtUsers.length === 0) continue;

    const { rows: columns } = await db.execute(`PRAGMA table_info("${table}")`);
    for (const fk of pointingAtUsers) {
      const column = String(fk.from);
      const info = columns.find((c) => String(c.name) === column);
      refs.push({ table, column, required: Number(info?.notnull ?? 0) === 1 });
    }
  }

  refCache = refs;
  return refs;
}

/**
 * Delete a user account. Nullable references to them (audit columns such as
 * site_details.updated_by or los_requests.approved_by) are cleared so the
 * history rows survive without the account. If a NOT NULL reference still
 * points at them — content they authored, like a proposal or a project run —
 * nothing is deleted and the blocking rows are reported instead.
 */
export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const db = getDb();
  const refs = await getUserRefs();

  const tx = await db.transaction('write');
  try {
    for (const ref of refs.filter((r) => !r.required)) {
      await tx.execute({
        sql: `UPDATE "${ref.table}" SET "${ref.column}" = NULL WHERE "${ref.column}" = ?`,
        args: [userId],
      });
    }
    await tx.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
    await tx.commit();
    return { ok: true };
  } catch (err) {
    await tx.rollback();
    if (!String((err as { code?: string }).code ?? '').includes('SQLITE_CONSTRAINT')) throw err;

    const blockedBy: Array<{ table: string; column: string; count: number }> = [];
    for (const ref of refs.filter((r) => r.required)) {
      const { rows } = await db.execute({
        sql: `SELECT COUNT(*) AS n FROM "${ref.table}" WHERE "${ref.column}" = ?`,
        args: [userId],
      });
      const count = Number(rows[0]?.n ?? 0);
      if (count > 0) blockedBy.push({ table: ref.table, column: ref.column, count });
    }
    return { ok: false, blockedBy };
  }
}

/** Human-readable explanation of why a delete was blocked. */
export function describeBlockers(blockedBy: Array<{ table: string; count: number }>): string {
  if (blockedBy.length === 0) {
    return 'Could not remove this member because other records still reference them.';
  }
  const parts = blockedBy.map((b) => `${b.count} in ${b.table.replace(/_/g, ' ')}`);
  return `Cannot remove this member: they are still the author of ${parts.join(', ')}. Reassign or delete those first.`;
}
