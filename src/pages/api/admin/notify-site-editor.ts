export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { sendEmail, buildSiteReviewEmail } from '../../../lib/email';

export const POST: APIRoute = async ({ locals, request, url }) => {
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

  // Get site and user details
  const site = await db.execute({ sql: 'SELECT site_name FROM site_details WHERE id = ?', args: [siteId] });
  if (site.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Site not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await db.execute({
    sql: 'SELECT full_name, email FROM users WHERE id = ?',
    args: [userId],
  });
  if (user.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify assignment exists
  const assignment = await db.execute({
    sql: 'SELECT id FROM site_editors WHERE site_id = ? AND user_id = ?',
    args: [siteId, userId],
  });
  if (assignment.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'User is not assigned to this site' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const siteName = site.rows[0].site_name as string;
  const userName = (user.rows[0].full_name as string) || 'Team Member';
  const userEmail = user.rows[0].email as string;

  const siteUrl = `${url.origin}/portal/site-details`;
  const html = buildSiteReviewEmail(userName, siteName, siteUrl);

  const result = await sendEmail(
    userEmail,
    `Action Required: Please review site details for ${siteName}`,
    html,
  );

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error || 'Failed to send email' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Record notification timestamp
  await db.execute({
    sql: 'UPDATE site_editors SET notified_at = datetime(\'now\') WHERE site_id = ? AND user_id = ?',
    args: [siteId, userId],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
