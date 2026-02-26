export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createClient(request, cookies);
  await supabase.auth.signOut();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
