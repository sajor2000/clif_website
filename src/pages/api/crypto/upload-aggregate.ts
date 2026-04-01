export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import {
  parseMaskedCsv,
  unmaskServerSide,
  type StrataDimension,
} from '../../../lib/crypto-masking';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { projectId, csvData } = await request.json();

  if (!projectId || !csvData) {
    return new Response(JSON.stringify({ error: 'projectId and csvData are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Verify project and permissions
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
    return new Response(JSON.stringify({ error: 'Only the project creator can upload aggregated data.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (project.status === 'complete') {
    return new Response(
      JSON.stringify({ error: 'This project has already been unmasked. Unmasking is a one-time operation.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (project.status !== 'keys_assigned' && project.status !== 'collecting') {
    return new Response(
      JSON.stringify({ error: `Cannot upload data in status: ${project.status}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const strataConfig: StrataDimension[] = JSON.parse(project.strata_config as string);
  const { data, errors } = parseMaskedCsv(csvData, strataConfig);

  if (errors.length > 0) {
    return new Response(
      JSON.stringify({ error: `CSV parsing errors:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const cellCount = Object.keys(data).length;
  if (cellCount === 0) {
    return new Response(JSON.stringify({ error: 'No valid data rows found in CSV.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();

  // Upsert submission (replace if exists)
  await db.execute({
    sql: 'DELETE FROM crypto_submissions WHERE project_id = ?',
    args: [projectId],
  });

  await db.execute({
    sql: `INSERT INTO crypto_submissions (id, project_id, submitted_by, submission_data, submitted_at)
          VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)`,
    args: [projectId, locals.user.id, JSON.stringify(data), now],
  });

  // Fetch all site key fragments
  const siteKeysResult = await db.execute({
    sql: 'SELECT key_index, key_data, is_dropped FROM crypto_site_keys WHERE project_id = ? ORDER BY key_index',
    args: [projectId],
  });

  const allFragments: Record<string, number>[] = [];
  const droppedIndices: number[] = [];

  for (let i = 0; i < siteKeysResult.rows.length; i++) {
    const row = siteKeysResult.rows[i];
    allFragments.push(JSON.parse(row.key_data as string));
    if (row.is_dropped) {
      droppedIndices.push(i);
    }
  }

  // Unmask using active (non-dropped) fragments only
  const unmaskResult = unmaskServerSide(data, allFragments, droppedIndices);

  // Wipe all fragment key data — one-time operation, no re-unmask
  await db.execute({
    sql: `UPDATE crypto_site_keys SET key_data = '{}' WHERE project_id = ?`,
    args: [projectId],
  });

  // Store result and mark complete
  await db.execute({
    sql: `UPDATE crypto_projects SET status = 'complete', result_data = ?, updated_at = ? WHERE id = ?`,
    args: [JSON.stringify(unmaskResult.result), now, projectId],
  });

  return new Response(
    JSON.stringify({
      success: true,
      cellCount,
      result: unmaskResult.result,
      warnings: unmaskResult.warnings,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
