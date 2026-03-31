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

  const { projectId, keyId, dropped } = await request.json();

  if (!projectId || !keyId || typeof dropped !== 'boolean') {
    return new Response(JSON.stringify({ error: 'projectId, keyId, and dropped (boolean) are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Verify project
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

  // Only the project creator or admin can drop sites
  if (project.created_by !== locals.user.id && locals.user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Only the project creator can drop or restore sites.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Can only drop/restore during keys_assigned or collecting (before unmasking)
  if (project.status !== 'keys_assigned' && project.status !== 'collecting') {
    return new Response(
      JSON.stringify({ error: `Sites can only be dropped/restored in status: keys_assigned or collecting. Current: ${project.status}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Verify the key belongs to this project
  const keyResult = await db.execute({
    sql: 'SELECT id, label FROM crypto_site_keys WHERE id = ? AND project_id = ?',
    args: [keyId, projectId],
  });

  if (keyResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Key fragment not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();

  await db.execute({
    sql: 'UPDATE crypto_site_keys SET is_dropped = ? WHERE id = ?',
    args: [dropped ? 1 : 0, keyId],
  });

  await db.execute({
    sql: 'UPDATE crypto_projects SET updated_at = ? WHERE id = ?',
    args: [now, projectId],
  });

  return new Response(
    JSON.stringify({ success: true, label: keyResult.rows[0].label, dropped }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
