export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { membersToCsv, membersToXlsx, resolveFields } from '../../../lib/member-export';

export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user || !user.is_approved) {
    return new Response('Unauthorized', { status: 401 });
  }

  const form = await request.formData();
  const format = form.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const fields = resolveFields(form.getAll('fields').map(String), user.role === 'admin');
  const ids = new Set(form.getAll('ids').map(String));
  const scope = form.get('scope') === 'selected' ? 'selected' : 'all';

  if (scope === 'selected' && ids.size === 0) {
    return new Response('No members selected.', { status: 400 });
  }

  const result = await getDb().execute('SELECT * FROM users WHERE is_approved = 1 ORDER BY full_name');
  const members = result.rows.filter((m) => scope === 'all' || ids.has(String(m.id)));

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `clif-member-directory-${stamp}.${format}`;
  const headers = {
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  };

  if (format === 'xlsx') {
    return new Response(membersToXlsx(members, fields), {
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  }
  return new Response(membersToCsv(members, fields), {
    headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' },
  });
};
