export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { sendEmail } from '../../../lib/email';

export const POST: APIRoute = async ({ locals, request, url }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { userId } = await request.json();

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  await db.execute({
    sql: 'UPDATE users SET is_approved = 1, updated_at = ? WHERE id = ?',
    args: [new Date().toISOString(), userId],
  });

  // Notify the user they've been approved
  const userResult = await db.execute({ sql: 'SELECT full_name, email FROM users WHERE id = ?', args: [userId] });
  if (userResult.rows.length > 0) {
    const u = userResult.rows[0];
    const portalUrl = `${url.origin}/portal`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="border-bottom: 3px solid #8B1538; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #8B1538; font-size: 20px; margin: 0;">CLIF Consortium</h1>
  </div>
  <p>Hi ${u.full_name || 'there'},</p>
  <p>Your CLIF Consortium account has been <strong>approved</strong>! You now have access to the members portal.</p>
  <div style="margin: 28px 0;">
    <a href="${portalUrl}" style="background-color: #8B1538; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      Go to Portal
    </a>
  </div>
  <p style="color: #666; font-size: 14px;">If you have questions, reach out to your consortium admin.</p>
  <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #9ca3af;">
    CLIF Consortium &middot; Common Longitudinal ICU Data Format
  </div>
</body>
</html>`;
    sendEmail(u.email as string, 'Your CLIF Consortium account has been approved', html).catch(() => {});
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
