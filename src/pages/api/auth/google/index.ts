export const prerender = false;

import type { APIRoute } from 'astro';
import { Google, generateState, generateCodeVerifier } from 'arctic';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const google = new Google(
    process.env.GOOGLE_CLIENT_ID || import.meta.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET || import.meta.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || import.meta.env.GOOGLE_REDIRECT_URI
  );

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = google.createAuthorizationURL(state, codeVerifier, [
    'openid',
    'email',
    'profile',
  ]);

  cookies.set('google_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: 'lax',
    maxAge: 60 * 10,
  });

  cookies.set('google_oauth_code_verifier', codeVerifier, {
    path: '/',
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: 'lax',
    maxAge: 60 * 10,
  });

  return redirect(url.toString());
};
