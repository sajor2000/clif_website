export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { keyDataToCsv, type StrataDimension } from '../../../lib/crypto-masking';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { projectId } = await request.json();
  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Project ID is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Fetch project
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

  if (project.status === 'complete') {
    return new Response(
      JSON.stringify({ error: 'This project has been unmasked and all key data has been wiped. If you lost your key, contact the project coordinator to create a new project.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (project.status !== 'keys_assigned' && project.status !== 'collecting') {
    return new Response(
      JSON.stringify({ error: 'Keys are not yet available for download.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Find the key fragment this user is authorized to download
  const allKeysResult = await db.execute({
    sql: 'SELECT * FROM crypto_site_keys WHERE project_id = ?',
    args: [projectId],
  });

  const siteKey = allKeysResult.rows.find((row) => {
    const authorized: string[] = JSON.parse((row.authorized_users as string) || '[]');
    return authorized.includes(locals.user.id);
  });

  if (!siteKey) {
    return new Response(JSON.stringify({ error: 'You do not have an assigned key fragment for this project.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const keyData: Record<string, number> = JSON.parse(siteKey.key_data as string);
  const strataConfig: StrataDimension[] = JSON.parse(project.strata_config as string);

  // Convert to CSV
  const csv = keyDataToCsv(keyData, strataConfig);

  // Mark as downloaded
  const now = new Date().toISOString();
  await db.execute({
    sql: 'UPDATE crypto_site_keys SET downloaded_at = ? WHERE id = ? AND downloaded_at IS NULL',
    args: [now, siteKey.id],
  });

  // Update project status to collecting if still keys_assigned
  if (project.status === 'keys_assigned') {
    await db.execute({
      sql: `UPDATE crypto_projects SET status = 'collecting', updated_at = ? WHERE id = ? AND status = 'keys_assigned'`,
      args: [now, projectId],
    });
  }

  const filename = `key_fragment_${siteKey.label?.toString().replace(/\s+/g, '_') || siteKey.key_index}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
