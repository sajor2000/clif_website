# Google OAuth Login Setup Guide

A step-by-step guide for setting up Google OAuth authentication with an Astro website deployed on Vercel, using Turso (SQLite) as the database.

## Architecture Overview

```
User clicks "Sign in with Google"
  → Your server redirects to Google's OAuth consent screen
  → User approves, Google redirects back to your callback URL
  → Your server exchanges the code for tokens, gets user info (email, name, avatar)
  → User record created/updated in Turso database
  → Session cookie set, user redirected to the app
```

**Stack:**
- **Framework**: Astro (with `output: 'server'` for SSR)
- **OAuth Library**: `arctic` (lightweight, zero-dependency)
- **Database**: Turso (serverless SQLite)
- **Deployment**: Vercel (serverless)
- **Cost**: $0 (all services have free tiers sufficient for small-medium apps)

---

## Step 1: Google Cloud Console Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with any Google account (personal Gmail works fine)
3. **Create a project**: Click project dropdown → "New Project" → name it → Create
4. **Configure OAuth consent screen**:
   - Go to **Google Auth Platform → Overview → Get Started**
   - Choose **External** (available to any Google account)
   - Fill in app name and contact emails
   - Click through remaining steps with defaults
   - **Publish the app** (under Audience → Publishing status) so it's not limited to 100 test users
5. **Create OAuth credentials**:
   - Go to **Clients** → Create client
   - Application type: **Web application**
   - Name: your app name
   - **Authorized redirect URIs** (NOT JavaScript origins):
     - `http://localhost:4321/api/auth/google/callback` (development)
     - `https://yourdomain.com/api/auth/google/callback` (production)
   - Click Create
   - Copy the **Client ID** and **Client Secret**

### Important Notes
- The redirect URIs must match EXACTLY what your server sends (including protocol and path)
- OAuth consent screen must be published for non-test users to sign in
- Only `openid`, `email`, `profile` scopes are needed — no Google verification required
- This is completely free regardless of user count

---

## Step 2: Turso Database Setup

1. Install Turso CLI: `brew install tursodatabase/tap/turso` (or see [turso.tech](https://turso.tech))
2. Sign up: `turso auth login`
3. Create database: `turso db create your-app-name`
4. Get credentials:
   - `turso db show your-app-name --url` → `TURSO_DATABASE_URL`
   - `turso db tokens create your-app-name` → `TURSO_AUTH_TOKEN`

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL UNIQUE,
  google_id TEXT UNIQUE,
  full_name TEXT,
  institution TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  is_approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
```

Run via: `turso db shell your-app-name < schema.sql`

---

## Step 3: Astro Project Setup

### Install Dependencies

```bash
npm install arctic @libsql/client
```

- `arctic` — Google OAuth (Authorization Code flow with PKCE)
- `@libsql/client` — Turso database client

### Enable SSR

In `astro.config.mjs`:
```js
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  // ... other config
});
```

### Environment Variables

Create `.env`:
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_REDIRECT_URI=http://localhost:4321/api/auth/google/callback
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
```

---

## Step 4: Core Auth Files

### Database Client (`src/lib/turso.ts`)

```typescript
import { createClient } from '@libsql/client';

let client: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (!client) {
    // process.env for Vercel runtime, import.meta.env for local dev
    const env = process.env;
    client = createClient({
      url: env['TURSO_DATABASE_URL'] || import.meta.env.TURSO_DATABASE_URL,
      authToken: env['TURSO_AUTH_TOKEN'] || import.meta.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}
```

> **Important**: Use `process.env` with bracket notation for Vercel serverless functions. Vite replaces `import.meta.env.X` at build time, which may be `undefined` if env vars are only available at runtime.

### Session Management (`src/lib/session.ts`)

```typescript
import type { AstroCookies } from 'astro';
import { getDb } from './turso';

const SESSION_DURATION_DAYS = 30;
const COOKIE_NAME = 'session_id';

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(userId: string, cookies: AstroCookies) {
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
}

export async function getSession(cookies: AstroCookies) {
  const sessionId = cookies.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const db = getDb();
  const result = await db.execute({
    sql: `SELECT u.id, u.email, u.full_name, u.role, u.is_approved
          FROM sessions s JOIN users u ON s.user_id = u.id
          WHERE s.id = ? AND s.expires_at > ?`,
    args: [sessionId, new Date().toISOString()],
  });

  if (result.rows.length === 0) {
    cookies.delete(COOKIE_NAME, { path: '/' });
    return null;
  }

  return result.rows[0];
}

export async function destroySession(cookies: AstroCookies) {
  const sessionId = cookies.get(COOKIE_NAME)?.value;
  if (sessionId) {
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [sessionId] });
  }
  cookies.delete(COOKIE_NAME, { path: '/' });
}
```

---

## Step 5: OAuth API Routes

### Initiate OAuth (`src/pages/api/auth/google/index.ts`)

```typescript
export const prerender = false;

import type { APIRoute } from 'astro';
import { Google, generateState, generateCodeVerifier } from 'arctic';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const env = process.env;
  const google = new Google(
    env['GOOGLE_CLIENT_ID'] || '',
    env['GOOGLE_CLIENT_SECRET'] || '',
    env['GOOGLE_REDIRECT_URI'] || ''
  );

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = google.createAuthorizationURL(state, codeVerifier, [
    'openid', 'email', 'profile',
  ]);

  // Store state and codeVerifier in short-lived cookies
  cookies.set('google_oauth_state', state, {
    path: '/', httpOnly: true, secure: !import.meta.env.DEV,
    sameSite: 'lax', maxAge: 60 * 10,
  });
  cookies.set('google_oauth_code_verifier', codeVerifier, {
    path: '/', httpOnly: true, secure: !import.meta.env.DEV,
    sameSite: 'lax', maxAge: 60 * 10,
  });

  return redirect(url.toString());
};
```

### Handle Callback (`src/pages/api/auth/google/callback.ts`)

```typescript
export const prerender = false;

import type { APIRoute } from 'astro';
import { Google, decodeIdToken } from 'arctic';
import { getDb } from '../../../../lib/turso';
import { createSession } from '../../../../lib/session';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('google_oauth_state')?.value;
  const codeVerifier = cookies.get('google_oauth_code_verifier')?.value;

  if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
    return redirect('/login?error=invalid_state');
  }

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
    const claims = decodeIdToken(tokens.idToken()) as any;
    const { sub: googleId, email, name, picture } = claims;

    const db = getDb();
    const now = new Date().toISOString();

    // Upsert user
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE google_id = ? OR email = ?',
      args: [googleId, email],
    });

    let userId: string;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id as string;
      await db.execute({
        sql: 'UPDATE users SET google_id = ?, full_name = COALESCE(full_name, ?), avatar_url = ?, updated_at = ? WHERE id = ?',
        args: [googleId, name, picture, now, userId],
      });
    } else {
      const result = await db.execute({
        sql: `INSERT INTO users (id, email, google_id, full_name, avatar_url, created_at, updated_at)
              VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [email, googleId, name, picture, now, now],
      });
      userId = result.rows[0].id as string;
    }

    await createSession(userId, cookies);
    return redirect('/dashboard'); // or wherever you want to send them
  } catch (error) {
    console.error('OAuth error:', error);
    return redirect('/login?error=oauth_failed');
  }
};
```

### Logout (`src/pages/api/auth/logout.ts`)

```typescript
export const prerender = false;

import type { APIRoute } from 'astro';
import { destroySession } from '../../../lib/session';

export const POST: APIRoute = async ({ cookies }) => {
  await destroySession(cookies);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

---

## Step 6: Middleware (`src/middleware.ts`)

```typescript
import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/session';

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, locals, url, redirect } = context;
  const pathname = url.pathname;

  // Public routes — skip auth
  if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/api/')) {
    locals.user = null;
    return next();
  }

  const user = await getSession(cookies);
  locals.user = user;

  // API routes — attach user and continue
  if (pathname.startsWith('/api/')) return next();

  // Protected routes — require login
  if (!user) return redirect('/login');

  return next();
});
```

---

## Step 7: Login Page (`src/pages/login.astro`)

```astro
---
export const prerender = false;
import BaseLayout from '../layouts/BaseLayout.astro';

if (Astro.locals.user) return Astro.redirect('/dashboard');
---

<BaseLayout title="Sign In">
  <a href="/api/auth/google">
    Sign in with Google
  </a>
</BaseLayout>
```

---

## Step 8: Vercel Deployment

### Key Gotcha: `process.env` vs `import.meta.env`

Vite replaces `import.meta.env.X` at **build time**. On Vercel, environment variables set in the dashboard are available at **runtime** via `process.env`. If your env vars aren't available during the build (which is common), `import.meta.env.X` will be `undefined`.

**Solution**: Use `process.env` with bracket notation in server-side code:
```typescript
// DO THIS in server-side API routes:
const env = process.env;
const clientId = env['GOOGLE_CLIENT_ID'] || '';

// NOT THIS (may be undefined on Vercel):
const clientId = import.meta.env.GOOGLE_CLIENT_ID;
```

### Adding Environment Variables

**Via Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Add all 5 variables for Production environment
3. Redeploy

**Via Vercel CLI:**
```bash
# Install and login
npx vercel login

# Add variables (use printf to avoid trailing newlines)
printf '%s' 'your-value' | npx vercel env add VARIABLE_NAME production

# Verify
npx vercel env ls
```

> **Warning**: Using `echo` to pipe values adds a trailing newline that breaks OAuth. Always use `printf '%s'`.

### Google Cloud Console Redirect URI

Make sure your production callback URL is added to the **Authorized redirect URIs** in Google Cloud Console:
```
https://yourdomain.com/api/auth/google/callback
```

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `client_id=undefined` in Google redirect URL | Env vars not available at runtime | Use `process.env` with bracket notation |
| Google 400 "malformed request" | Trailing newline in env var values | Use `printf '%s'` instead of `echo` when setting env vars |
| Google 401 "invalid_client" | Wrong or placeholder client ID | Check `GOOGLE_CLIENT_ID` in env vars |
| `oauth_failed` after Google redirect | Database or token exchange error | Check Vercel runtime logs; verify Turso credentials |
| Redirect URI mismatch | URL in code doesn't match Google Console | Must match exactly (protocol, domain, path) |
| Works locally but not on Vercel | Different Vercel projects for CLI vs git deploys | Check which project owns your domain; add env vars there |

---

## Cost Summary

| Service | Free Tier | Enough For |
|---|---|---|
| Google OAuth | Unlimited, forever free | Any size |
| Turso | 9 GB storage, 500M rows read/month | ~50-500 users |
| Vercel | 100 GB bandwidth, serverless functions | Small-medium sites |

Total cost for a consortium/small org: **$0/month**
