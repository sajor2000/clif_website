export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password, full_name, institution } = await request.json();

  if (!email || !password || !full_name) {
    return new Response(JSON.stringify({ error: 'Name, email, and password are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(request, cookies);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        institution: institution || '',
      },
    },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ user: data.user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
