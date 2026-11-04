import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GOOGLE_TOKEN_URI, buildJwtAssertion, parseServiceAccountKey } from './google-service-account';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

function decode(part: string): any {
  return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
}

describe('parseServiceAccountKey', () => {
  it('accepts a pasted key file', () => {
    const k = parseServiceAccountKey(JSON.stringify({ client_email: 'a@b.iam', private_key: pem, token_uri: GOOGLE_TOKEN_URI }));
    expect(k.client_email).toBe('a@b.iam');
  });

  it('rejects missing, malformed, and incomplete values with a clear message', () => {
    expect(() => parseServiceAccountKey(undefined)).toThrow(/not configured/);
    expect(() => parseServiceAccountKey('{nope')).toThrow(/valid JSON/);
    expect(() => parseServiceAccountKey('{"client_email":"x"}')).toThrow(/private_key/);
  });
});

describe('buildJwtAssertion', () => {
  it('produces an RS256 JWT with the right claims that verifies against the public key', () => {
    const now = new Date('2026-11-04T11:00:00Z');
    const jwt = buildJwtAssertion({ client_email: 'svc@p.iam', private_key: pem }, ['https://www.googleapis.com/auth/presentations'], now);
    const [h, c, s] = jwt.split('.');
    expect(decode(h)).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claims = decode(c);
    expect(claims.iss).toBe('svc@p.iam');
    expect(claims.aud).toBe(GOOGLE_TOKEN_URI);
    expect(claims.scope).toBe('https://www.googleapis.com/auth/presentations');
    expect(claims.exp - claims.iat).toBe(3600);
    expect(claims.iat).toBe(Math.floor(now.getTime() / 1000));

    const v = createVerify('RSA-SHA256');
    v.update(`${h}.${c}`);
    const sig = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    expect(v.verify(publicKey, sig)).toBe(true);
  });
});
