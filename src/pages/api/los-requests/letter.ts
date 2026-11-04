export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { hasRole } from '../../../lib/roles';
import { buildLetterContent, letterFileName, type Signatory } from '../../../lib/los-letter';
import { renderLetterDocx } from '../../../lib/los-letter-docx';
import { renderLetterPdf } from '../../../lib/los-letter-pdf';

/**
 * Download the generated letter of collaboration for a request.
 *
 * GET /api/los-requests/letter?id=<request>&format=docx|pdf
 *
 * The requestor, steering committee and admins may download. The letter is
 * dated today and signed by every site PI whose decision is 'approved' (their
 * name line prints even when no signature image is on file).
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.user;
  if (!user || !user.is_approved) return json({ error: 'Forbidden' }, 403);

  const id = url.searchParams.get('id') || '';
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'docx';
  if (!id) return json({ error: 'id is required.' }, 400);

  const db = getDb();
  const reqRes = await db.execute({
    sql: `SELECT id, grant_title, grant_type, applicant_pi, applicant_institution, funding_agency, extra_paragraph, created_by
          FROM los_requests WHERE id = ?`,
    args: [id],
  });
  const r = reqRes.rows[0];
  if (!r) return json({ error: 'Not found.' }, 404);
  if (!hasRole(user.role, 'steering') && r.created_by !== user.id) return json({ error: 'Forbidden' }, 403);

  const piRes = await db.execute({
    sql: `SELECT u.id, u.full_name, u.degrees, u.institution, s.mime, s.data, s.width, s.height
          FROM los_approvals a
          JOIN users u ON u.id = a.user_id
          LEFT JOIN pi_signatures s ON s.user_id = u.id
          WHERE a.request_id = ? AND a.decision = 'approved'`,
    args: [id],
  });
  if (piRes.rows.length === 0) return json({ error: 'No site PI has approved this request yet.' }, 400);

  const signatories: Signatory[] = piRes.rows.map((row) => ({
    user_id: String(row.id),
    full_name: (row.full_name as string | null) ?? null,
    degrees: (row.degrees as string | null) ?? null,
    institution: (row.institution as string | null) ?? null,
    signature:
      row.data && (row.mime === 'image/png' || row.mime === 'image/jpeg')
        ? {
            mime: row.mime,
            data: toBytes(row.data),
            width: Number(row.width),
            height: Number(row.height),
          }
        : null,
  }));

  const fields = {
    grant_title: String(r.grant_title),
    grant_type: (r.grant_type as string | null) ?? null,
    applicant_pi: (r.applicant_pi as string | null) ?? null,
    applicant_institution: (r.applicant_institution as string | null) ?? null,
    funding_agency: (r.funding_agency as string | null) ?? null,
    extra_paragraph: (r.extra_paragraph as string | null) ?? null,
  };
  const now = new Date();
  const content = buildLetterContent(fields, signatories, now);
  const bytes = format === 'pdf' ? await renderLetterPdf(content) : await renderLetterDocx(content);

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type':
        format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${letterFileName(fields, format, now)}"`,
      'Cache-Control': 'no-store',
    },
  });
};

/** libsql returns BLOB columns as ArrayBuffer. */
function toBytes(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return new Uint8Array(0);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
