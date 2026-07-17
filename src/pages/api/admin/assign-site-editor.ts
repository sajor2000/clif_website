export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { createNotification } from '../../../lib/notifications';

export const POST: APIRoute = async ({ locals, request }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { siteId, userId } = await request.json();

  if (!siteId || !userId) {
    return new Response(JSON.stringify({ error: 'siteId and userId are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Verify site and user exist
  const site = await db.execute({ sql: 'SELECT id, site_name FROM site_details WHERE id = ?', args: [siteId] });
  if (site.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Site not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await db.execute({ sql: 'SELECT id FROM users WHERE id = ? AND is_approved = 1', args: [userId] });
  if (user.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'User not found or not approved' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await db.execute({
    sql: `INSERT INTO site_editors (id, site_id, user_id, assigned_by)
          VALUES (lower(hex(randomblob(16))), ?, ?, ?)
          ON CONFLICT(site_id, user_id) DO NOTHING`,
    args: [siteId, userId, locals.user.id],
  });

  const alreadyAssigned = result.rowsAffected === 0;

  // Ring the assignee's bell — but only on a genuinely new assignment, so a
  // re-assign no-op (ON CONFLICT DO NOTHING) doesn't spam them. Their derived
  // pending tasks already reflect the site; this is the discrete "you were
  // assigned" event. Awaited (not fire-and-forget): on a serverless host the
  // instance can freeze the moment we respond, so a detached insert might
  // never commit. createNotification swallows its own errors, so a
  // notification hiccup still can't fail the assignment.
  if (!alreadyAssigned) {
    const siteName = (site.rows[0].site_name as string) || 'a site';
    await createNotification(userId, {
      type: 'site_editor.assigned',
      title: `You've been assigned to review ${siteName}`,
      body: 'Please review and complete this site’s details in the portal.',
      link: '/portal/site-details',
      entityType: 'site',
      entityId: siteId,
      actorId: locals.user.id,
    });
  }

  return new Response(JSON.stringify({ success: true, alreadyAssigned }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
