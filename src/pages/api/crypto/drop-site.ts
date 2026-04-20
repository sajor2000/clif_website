export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

/**
 * Drop (or restore) a site across every key_set in the project. Dropping
 * is a project-level decision — if a site can't contribute, they can't
 * contribute to any key set.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { projectId, keyId, siteName: siteNameInput, dropped } = await request.json();

  if (!projectId || typeof dropped !== 'boolean' || (!keyId && !siteNameInput)) {
    return new Response(JSON.stringify({ error: 'projectId, dropped (boolean), and one of (keyId, siteName) are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const projectResult = await db.execute({
    sql: 'SELECT * FROM crypto_projects WHERE id = ?',
    args: [projectId],
  });

  if (projectResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Project not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const project = projectResult.rows[0];

  if (project.created_by !== locals.user.id && locals.user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Only the project creator can drop or restore sites.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Resolve site_name from keyId if the caller didn't supply one directly.
  let siteName: string | null = siteNameInput || null;
  if (!siteName) {
    const keyResult = await db.execute({
      sql: 'SELECT site_name FROM crypto_site_keys WHERE id = ? AND project_id = ?',
      args: [keyId, projectId],
    });
    if (keyResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Key fragment not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    siteName = keyResult.rows[0].site_name as string;
  }

  // Block drop/restore once any key_set for the project is complete — the
  // master key for that key_set has already been fixed against the old
  // dropped set.
  const completedResult = await db.execute({
    sql: `SELECT COUNT(*) as c FROM crypto_key_sets WHERE project_id = ? AND status = 'complete'`,
    args: [projectId],
  });
  if (Number(completedResult.rows[0]?.c ?? 0) > 0) {
    return new Response(
      JSON.stringify({ error: 'Cannot drop/restore sites after any key set has been finalized.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const now = new Date().toISOString();

  await db.execute({
    sql: 'UPDATE crypto_site_keys SET is_dropped = ? WHERE project_id = ? AND site_name = ?',
    args: [dropped ? 1 : 0, projectId, siteName],
  });

  await db.execute({
    sql: 'UPDATE crypto_projects SET updated_at = ? WHERE id = ?',
    args: [now, projectId],
  });

  return new Response(
    JSON.stringify({ success: true, siteName, dropped }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
