import { createSign } from 'node:crypto';

/**
 * Minimal Google service-account auth: build a signed JWT from the key file
 * and exchange it for a short-lived OAuth2 access token. Used by server-side
 * jobs (the weekly project-run slide) that act on Google Workspace files
 * shared with the service account; no googleapis dependency needed.
 *
 * GOOGLE_SERVICE_ACCOUNT_JSON holds the entire key file downloaded from the
 * Cloud Console, pasted as one value.
 */
export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';

export function parseServiceAccountKey(raw: string | undefined | null): ServiceAccountKey {
  if (!raw || !raw.trim()) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON (paste the whole key file)');
  }
  const k = parsed as Partial<ServiceAccountKey>;
  if (typeof k.client_email !== 'string' || typeof k.private_key !== 'string') {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key');
  }
  return { client_email: k.client_email, private_key: k.private_key, token_uri: k.token_uri };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** RS256-signed JWT bearer assertion for the given scopes (valid one hour). */
export function buildJwtAssertion(key: ServiceAccountKey, scopes: string[], now: Date = new Date()): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: scopes.join(' '),
      aud: key.token_uri || GOOGLE_TOKEN_URI,
      iat,
      exp: iat + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  return `${unsigned}.${base64url(signer.sign(key.private_key))}`;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** Access token for the scopes, cached per scope set until shortly before expiry. */
export async function getServiceAccountAccessToken(key: ServiceAccountKey, scopes: string[]): Promise<string> {
  const cacheKey = `${key.client_email}|${scopes.join(' ')}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: buildJwtAssertion(key, scopes),
  });
  const res = await fetch(key.token_uri || GOOGLE_TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Google token exchange failed: ${data.error || res.status} ${data.error_description || ''}`.trim());
  }
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 });
  return data.access_token;
}
