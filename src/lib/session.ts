import type { AstroCookies } from 'astro';
import { getDb } from './turso';

const SESSION_DURATION_DAYS = 30;
const REFRESH_THRESHOLD_DAYS = 7;
const COOKIE_NAME = 'session_id';

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
  institution: string | null;
  avatar_url: string | null;
  role: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export async function createSession(userId: string, cookies: AstroCookies): Promise<string> {
  const db = getDb();
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db.execute({
    sql: 'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    args: [sessionId, userId, expiresAt, new Date().toISOString()],
  });

  cookies.set(COOKIE_NAME, sessionId, {
    path: '/',
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: 'lax',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });

  return sessionId;
}

export async function getSession(cookies: AstroCookies): Promise<SessionUser | null> {
  const sessionId = cookies.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const db = getDb();
  const result = await db.execute({
    sql: `SELECT u.id, u.email, u.full_name, u.institution, u.avatar_url, u.role, u.is_approved, u.created_at, u.updated_at, s.expires_at
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.id = ? AND s.expires_at > ?`,
    args: [sessionId, new Date().toISOString()],
  });

  if (result.rows.length === 0) {
    cookies.delete(COOKIE_NAME, { path: '/' });
    return null;
  }

  const row = result.rows[0];

  // Sliding window: refresh if within last 7 days of expiry
  const expiresAt = new Date(row.expires_at as string);
  const refreshThreshold = new Date(Date.now() + REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  if (expiresAt < refreshThreshold) {
    const newExpiry = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await db.execute({
      sql: 'UPDATE sessions SET expires_at = ? WHERE id = ?',
      args: [newExpiry, sessionId],
    });
    cookies.set(COOKIE_NAME, sessionId, {
      path: '/',
      httpOnly: true,
      secure: !import.meta.env.DEV,
      sameSite: 'lax',
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    });
  }

  return {
    id: row.id as string,
    email: row.email as string,
    full_name: row.full_name as string | null,
    institution: row.institution as string | null,
    avatar_url: row.avatar_url as string | null,
    role: row.role as string,
    is_approved: Boolean(row.is_approved),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function destroySession(cookies: AstroCookies): Promise<void> {
  const sessionId = cookies.get(COOKIE_NAME)?.value;
  if (sessionId) {
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [sessionId] });
  }
  cookies.delete(COOKIE_NAME, { path: '/' });
}

export async function cleanupExpiredSessions(): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM sessions WHERE expires_at < ?',
    args: [new Date().toISOString()],
  });
}
