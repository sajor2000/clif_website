import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/session';

const PROTECTED_ROUTES = ['/portal'];
const ADMIN_ROUTES = ['/portal/admin'];
const AUTH_PAGES = ['/auth/login', '/auth/pending'];
const API_ROUTES = ['/api/'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, locals, url, redirect } = context;
  const pathname = url.pathname;

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthPage = AUTH_PAGES.some((r) => pathname === r);
  const isApiRoute = API_ROUTES.some((r) => pathname.startsWith(r));

  // Skip session lookup for routes that don't need it
  if (!isProtected && !isAdminRoute && !isAuthPage && !isApiRoute) {
    locals.user = null;
    return next();
  }

  const user = await getSession(cookies);
  locals.user = user;

  // Auth pages and API routes — just attach user state and continue
  if (isAuthPage || isApiRoute) {
    return next();
  }

  // Redirect unauthenticated users to login
  if (!user) {
    return redirect('/auth/login?redirect=' + encodeURIComponent(pathname));
  }

  // Protected routes require approval
  if (!user.is_approved) {
    return redirect('/auth/pending');
  }

  // Admin routes require admin role
  if (isAdminRoute && user.role !== 'admin') {
    return redirect('/portal');
  }

  return next();
});
