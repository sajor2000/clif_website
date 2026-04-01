export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { projectId, authorizedUserIds } = await request.json();

  if (!projectId || !Array.isArray(authorizedUserIds)) {
    return new Response(JSON.stringify({ error: 'projectId and authorizedUserIds are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const projectResult = await db.execute({
    sql: 'SELECT created_by FROM crypto_projects WHERE id = ?',
    args: [projectId],
  });

  if (projectResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Project not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (projectResult.rows[0].created_by !== locals.user.id) {
    return new Response(JSON.stringify({ error: 'Only the project creator can manage master key access.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate all user IDs are from the same institution as the creator
  if (authorizedUserIds.length > 0) {
    const creatorResult = await db.execute({
      sql: 'SELECT institution FROM users WHERE id = ?',
      args: [locals.user.id],
    });
    const creatorInstitution = creatorResult.rows[0]?.institution as string;

    const placeholders = authorizedUserIds.map(() => '?').join(',');
    const usersResult = await db.execute({
      sql: `SELECT id, institution FROM users WHERE id IN (${placeholders})`,
      args: authorizedUserIds,
    });

    for (const row of usersResult.rows) {
      if (row.institution !== creatorInstitution) {
        return new Response(
          JSON.stringify({ error: 'All authorized users must be from your institution.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }
  }

  const now = new Date().toISOString();
  await db.execute({
    sql: 'UPDATE crypto_projects SET master_key_authorized = ?, updated_at = ? WHERE id = ?',
    args: [JSON.stringify(authorizedUserIds), now, projectId],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
