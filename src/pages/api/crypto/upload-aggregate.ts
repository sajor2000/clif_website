export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { parseMaskedCsv, type StrataDimension } from '../../../lib/crypto-masking';

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

  if (project.status !== 'keys_assigned' && project.status !== 'collecting' && project.status !== 'complete') {
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

  // Reset status to collecting (handles initial upload and re-uploads from complete)
  await db.execute({
    sql: `UPDATE crypto_projects SET status = 'collecting', result_data = NULL, updated_at = ? WHERE id = ?`,
    args: [now, projectId],
  });

  return new Response(
    JSON.stringify({ success: true, cellCount }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
