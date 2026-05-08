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

    // Find an existing row to attach this OAuth login to. Priority:
    //   1) same google_id (returning user)
    //   2) same email (Google identity already on file)
    //   3) unattached profile (google_id IS NULL) whose work_email or
    //      gmail_personal matches the OAuth email — i.e. a CSV-imported stub
    //      for someone signing in with a personal Gmail.
    // Only step 3 ever triggers an email swap, since steps 1/2 already point
    // at a row whose `email` is the auth identity.
    let row: Record<string, unknown> | null = null;

    const byGoogle = await db.execute({
      sql: 'SELECT id, email, full_name, work_email FROM users WHERE google_id = ? LIMIT 1',
      args: [googleId],
    });
    if (byGoogle.rows[0]) row = byGoogle.rows[0];

    if (!row) {
      const byEmail = await db.execute({
        sql: 'SELECT id, email, full_name, work_email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
        args: [email],
      });
      if (byEmail.rows[0]) row = byEmail.rows[0];
    }

    if (!row) {
      const byAlt = await db.execute({
        sql: `SELECT id, email, full_name, work_email
              FROM users
              WHERE google_id IS NULL
                AND (LOWER(work_email) = LOWER(?) OR LOWER(gmail_personal) = LOWER(?))
              LIMIT 1`,
        args: [email, email],
      });
      if (byAlt.rows[0]) row = byAlt.rows[0];
    }

    let userId: string;

    if (row) {
      userId = row.id as string;
      const existingEmail = String(row.email || '').toLowerCase();
      const newEmail = email.toLowerCase();

      if (existingEmail !== newEmail) {
        // Matched via work_email or gmail_personal. The auth identity must be
        // the OAuth email going forward, so swap: preserve the old (work)
        // email in `work_email` if that column is currently empty.
        const setExprs = ['google_id = ?', 'email = ?', 'avatar_url = ?', 'updated_at = ?'];
        const args: (string | null)[] = [googleId, email, picture || null, now];
        if (!row.work_email) {
          setExprs.push('work_email = ?');
          args.push(row.email as string);
        }
        if (!row.full_name) {
          setExprs.push('full_name = ?');
          args.push(name || null);
        }
        args.push(userId);
        await db.execute({
          sql: `UPDATE users SET ${setExprs.join(', ')} WHERE id = ?`,
          args,
        });
      } else {
        // Email already matches — standard attach.
        await db.execute({
          sql: `UPDATE users SET google_id = ?, full_name = COALESCE(full_name, ?),
                avatar_url = ?, updated_at = ? WHERE id = ?`,
          args: [googleId, name || null, picture || null, now, userId],
        });
      }
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
