export const prerender = false;

import type { APIRoute } from 'astro';
import { Google, decodeIdToken } from 'arctic';
import { getDb } from '../../../../lib/turso';
import { createSession, cleanupExpiredSessions } from '../../../../lib/session';

interface GoogleIdTokenClaims {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('google_oauth_state')?.value;
  const codeVerifier = cookies.get('google_oauth_code_verifier')?.value;

  if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
    return redirect('/auth/login?error=invalid_state');
  }

  // Clean up OAuth cookies
  cookies.delete('google_oauth_state', { path: '/' });
  cookies.delete('google_oauth_code_verifier', { path: '/' });

  const env = process.env;
  const google = new Google(
    env['GOOGLE_CLIENT_ID'] || import.meta.env.GOOGLE_CLIENT_ID || '',
    env['GOOGLE_CLIENT_SECRET'] || import.meta.env.GOOGLE_CLIENT_SECRET || '',
    env['GOOGLE_REDIRECT_URI'] || import.meta.env.GOOGLE_REDIRECT_URI || ''
  );

  try {
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    const claims = decodeIdToken(tokens.idToken()) as GoogleIdTokenClaims;

    const { sub: googleId, email, name, picture } = claims;

    if (!email) {
      return redirect('/auth/login?error=no_email');
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Resolve this OAuth login to a member via the user_identities table, which
    // lets one member link several Google logins. Priority:
    //   1) a linked identity with this google_id (returning user)
    //   2) a linked identity with this email
    //   3) a member with no Google identity yet whose work_email or
    //      gmail_personal matches the OAuth email — i.e. a CSV-imported stub
    //      for someone signing in with a personal Gmail.
    // We never overwrite the member's primary email anymore: a matched login is
    // recorded as an additional identity instead (see the INSERT below).
    let row: Record<string, unknown> | null = null;

    const byGoogle = await db.execute({
      sql: `SELECT u.id, u.email, u.full_name, u.work_email
            FROM user_identities ui JOIN users u ON u.id = ui.user_id
            WHERE ui.google_id = ? LIMIT 1`,
      args: [googleId],
    });
    if (byGoogle.rows[0]) row = byGoogle.rows[0];

    if (!row) {
      const byEmail = await db.execute({
        sql: `SELECT u.id, u.email, u.full_name, u.work_email
              FROM user_identities ui JOIN users u ON u.id = ui.user_id
              WHERE LOWER(ui.email) = LOWER(?) LIMIT 1`,
        args: [email],
      });
      if (byEmail.rows[0]) row = byEmail.rows[0];
    }

    if (!row) {
      // Un-attached stub (no Google identity on file) matched by a stored
      // work/personal email — link this login to it rather than create a dupe.
      const byAlt = await db.execute({
        sql: `SELECT id, email, full_name, work_email
              FROM users
              WHERE NOT EXISTS (
                      SELECT 1 FROM user_identities ui
                      WHERE ui.user_id = users.id AND ui.google_id IS NOT NULL
                    )
                AND (LOWER(work_email) = LOWER(?) OR LOWER(gmail_personal) = LOWER(?))
              LIMIT 1`,
        args: [email, email],
      });
      if (byAlt.rows[0]) row = byAlt.rows[0];
    }

    let userId: string;

    if (row) {
      userId = row.id as string;
      // Attach without clobbering the primary email. Fill in name/avatar, and
      // adopt this google_id as the member's primary only if they had none.
      await db.execute({
        sql: `UPDATE users SET google_id = COALESCE(google_id, ?), full_name = COALESCE(full_name, ?),
              avatar_url = ?, updated_at = ? WHERE id = ?`,
        args: [googleId, name || null, picture || null, now, userId],
      });
    } else {
      // New user — auto-create (unapproved).
      const result = await db.execute({
        sql: `INSERT INTO users (id, email, google_id, full_name, avatar_url, role, is_approved, created_at, updated_at)
              VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 'member', 0, ?, ?)
              RETURNING id`,
        args: [email, googleId, name || null, picture || null, now, now],
      });
      userId = result.rows[0].id as string;
    }

    // Record this login as a linked identity (idempotent on google_id). Marks
    // it primary only when the member has no identities yet (brand-new user).
    await db.execute({
      sql: `INSERT INTO user_identities (user_id, google_id, email, is_primary)
            SELECT ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM user_identities WHERE user_id = ?) THEN 0 ELSE 1 END
            WHERE NOT EXISTS (SELECT 1 FROM user_identities WHERE google_id = ?)`,
      args: [userId, googleId, email, userId, googleId],
    });

    // Create session (reuses existing session.ts logic)
    await createSession(userId, cookies);

    // Background cleanup
    cleanupExpiredSessions().catch(() => {});

    // Check user status
    const userResult = await db.execute({
      sql: 'SELECT is_approved, institution FROM users WHERE id = ?',
      args: [userId],
    });

    const status = userResult.rows[0];
    const isApproved = Boolean(status?.is_approved);
    const hasInstitution = Boolean(status?.institution);

    if (!hasInstitution) {
      return redirect('/auth/complete-profile');
    }
    return redirect(isApproved ? '/portal' : '/auth/pending');
  } catch (error) {
    console.error('Google OAuth error:', error);
    const msg = error instanceof Error ? error.message : 'unknown';
    return redirect('/auth/login?error=oauth_failed&detail=' + encodeURIComponent(msg));
  }
};
