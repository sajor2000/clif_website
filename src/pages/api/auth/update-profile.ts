export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { sendEmail, buildNewUserNotificationEmail } from '../../../lib/email';

const ADMIN_EMAIL = 'clif_consortium@uchicago.edu';

export const POST: APIRoute = async ({ locals, request, url }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { institution } = await request.json();

  if (!institution || !institution.trim()) {
    return new Response(JSON.stringify({ error: 'Institution is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  await db.execute({
    sql: 'UPDATE users SET institution = ?, updated_at = ? WHERE id = ?',
    args: [institution.trim(), new Date().toISOString(), locals.user.id],
  });

  const redirect = locals.user.is_approved ? '/portal' : '/auth/pending';

  // Notify admin of new signup (fire-and-forget, don't block the response)
  if (!locals.user.is_approved) {
    const adminUrl = `${url.origin}/portal/admin`;
    const html = buildNewUserNotificationEmail(
      locals.user.full_name || 'Unknown',
      locals.user.email,
      institution.trim(),
      adminUrl,
    );
    sendEmail(ADMIN_EMAIL, `New CLIF signup: ${locals.user.full_name || locals.user.email}`, html).catch(() => {});
  }

  return new Response(JSON.stringify({ success: true, redirect }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
