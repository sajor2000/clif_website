/**
 * Post-login redirect targets (deep links from emails and notifications).
 *
 * The middleware sends an anonymous visitor to /auth/login?redirect=<path>;
 * the login page forwards it to /api/auth/google, which parks it in a cookie
 * while Google handles sign-in; the callback consumes the cookie. Every hop
 * validates the value with safeRedirectPath so the chain can never bounce a
 * member to another site (open redirect).
 */

export const POST_LOGIN_REDIRECT_COOKIE = 'post_login_redirect';

/**
 * Accept only an absolute path on this site: starts with a single "/",
 * no scheme, no "//host", no control characters, reasonable length.
 * Returns null for anything else.
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length === 0 || v.length > 2048) return null;
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;
  // Never loop back into the auth pages themselves.
  if (v.startsWith('/auth/') || v.startsWith('/api/auth/')) return null;
  return v;
}
