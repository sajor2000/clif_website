export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

/**
 * Returns the SUM of all dropped fragment offsets for a project.
 * This allows the client to adjust the master key without the server
 * ever seeing the master key itself.
 *
 * Returns: { offsets: Record<string, number> } where each value is
 * the total offset to subtract from the master key for that cell.
 */
export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const projectId = url.searchParams.get('projectId');
  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Project ID is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Verify project and permissions
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

  if (projectResult.rows[0].created_by !== locals.user.id && locals.user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch dropped fragments and sum their offsets
  const droppedResult = await db.execute({
    sql: 'SELECT key_data FROM crypto_site_keys WHERE project_id = ? AND is_dropped = 1',
    args: [projectId],
  });

  const summedOffsets: Record<string, number> = {};

  for (const row of droppedResult.rows) {
    const fragmentData: Record<string, number> = JSON.parse(row.key_data as string);
    for (const [key, val] of Object.entries(fragmentData)) {
      summedOffsets[key] = (summedOffsets[key] || 0) + val;
    }
  }

  return new Response(JSON.stringify({ offsets: summedOffsets, droppedCount: droppedResult.rows.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
