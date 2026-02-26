export const prerender = false;

import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ locals, request }) => {
  if (locals.profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { userId } = await request.json();

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createAdminClient();

  // Delete the user from auth (cascade will delete profile)
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
