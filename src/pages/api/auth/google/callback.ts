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
    env['GOOGLE_CLIENT_ID'] || '',
    env['GOOGLE_CLIENT_SECRET'] || '',
    env['GOOGLE_REDIRECT_URI'] || ''
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

    // Check if user exists by google_id or email
    const existing = await db.execute({
      sql: 'SELECT id, google_id FROM users WHERE google_id = ? OR email = ?',
      args: [googleId, email],
    });

    let userId: string;

    if (existing.rows.length > 0) {
      // Existing user — update their Google info
      userId = existing.rows[0].id as string;
      await db.execute({
        sql: `UPDATE users SET google_id = ?, full_name = COALESCE(full_name, ?),
              avatar_url = ?, updated_at = ? WHERE id = ?`,
        args: [googleId, name || null, picture || null, now, userId],
      });
    } else {
      // New user — auto-create (unapproved)
      const result = await db.execute({
        sql: `INSERT INTO users (id, email, google_id, full_name, avatar_url, role, is_approved, created_at, updated_at)
              VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 'member', 0, ?, ?)
              RETURNING id`,
        args: [email, googleId, name || null, picture || null, now, now],
      });
      userId = result.rows[0].id as string;
    }

    // Create session (reuses existing session.ts logic)
    await createSession(userId, cookies);

    // Background cleanup
    cleanupExpiredSessions().catch(() => {});

    // Check if user is approved
    const userResult = await db.execute({
      sql: 'SELECT is_approved FROM users WHERE id = ?',
      args: [userId],
    });

    const isApproved = Boolean(userResult.rows[0]?.is_approved);
    return redirect(isApproved ? '/portal' : '/auth/pending');
  } catch (error) {
    console.error('Google OAuth error:', error);
    const msg = error instanceof Error ? error.message : 'unknown';
    return redirect('/auth/login?error=oauth_failed&detail=' + encodeURIComponent(msg));
  }
};
