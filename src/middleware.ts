import { defineMiddleware } from 'astro:middleware';
import { createClient, createAdminClient } from './lib/supabase';

const PROTECTED_ROUTES = ['/portal'];
const ADMIN_ROUTES = ['/portal/admin'];
const AUTH_PAGES = ['/auth/login', '/auth/signup', '/auth/callback', '/auth/pending'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, locals, url, redirect, request } = context;
  const pathname = url.pathname;

  // Determine if this route needs auth handling
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthPage = AUTH_PAGES.some((r) => pathname === r);

  // Skip Supabase for routes that don't need it (static/prerendered pages)
  if (!isProtected && !isAdminRoute && !isAuthPage) {
    locals.user = null;
    locals.profile = null;
    return next();
  }

  const supabase = createClient(request, cookies);

  // Refresh session and get user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  locals.supabase = supabase;
  locals.user = user;
  locals.profile = null;

  // Auth pages (login, signup) — just attach user state and continue
  if (isAuthPage) {
    return next();
  }

  // Public routes pass through
  if (!isProtected && !isAdminRoute) {
    return next();
  }

  // Redirect unauthenticated users to login
  if (!user) {
    return redirect('/auth/login?redirect=' + encodeURIComponent(pathname));
  }

  // Fetch user profile using admin client (bypasses RLS)
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  locals.profile = profile;

  // Protected routes require approval
  if (!profile?.is_approved) {
    return redirect('/auth/pending');
  }

  // Admin routes require admin role
  if (isAdminRoute && profile?.role !== 'admin') {
    return redirect('/portal');
  }

  return next();
});
