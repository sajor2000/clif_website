export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

const VALID_APPROVAL_TYPES = ['approval', 'exemption'];
const VALID_DEATH_SOURCES = [
  'Epic/EMRs - from encounters/death notes/check-ins/surveys',
  'Cancer registry - from updates/surveys periodically',
  'Social security registry - from updates periodically',
  'State Death registry',
];

export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { siteId } = body;

  if (!siteId) {
    return new Response(JSON.stringify({ error: 'siteId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Check authorization: admin or assigned editor
  if (user.role !== 'admin') {
    const editor = await db.execute({
      sql: 'SELECT id FROM site_editors WHERE site_id = ? AND user_id = ?',
      args: [siteId, user.id],
    });
    if (editor.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Validate irb_approval_type
  if (body.irb_approval_type && !VALID_APPROVAL_TYPES.includes(body.irb_approval_type)) {
    return new Response(JSON.stringify({ error: 'Invalid irb_approval_type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate death_dttm_source (JSON array)
  let deathSource: string | null = null;
  if (body.death_dttm_source) {
    if (!Array.isArray(body.death_dttm_source)) {
      return new Response(JSON.stringify({ error: 'death_dttm_source must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    for (const src of body.death_dttm_source) {
      if (!VALID_DEATH_SOURCES.includes(src)) {
        return new Response(JSON.stringify({ error: `Invalid death_dttm_source: ${src}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    deathSource = body.death_dttm_source.length > 0 ? JSON.stringify(body.death_dttm_source) : null;
  }

  await db.execute({
    sql: `UPDATE site_details SET
      hospital_type = ?,
      num_hospitals = ?,
      icu_beds = ?,
      data_source = ?,
      source_data_date_range = ?,
      clifed_date_range = ?,
      has_er_data = ?,
      has_icu_data = ?,
      has_ward_data = ?,
      irb_name = ?,
      irb_number = ?,
      irb_approval_date = ?,
      irb_approval_type = ?,
      cohort_inclusion_criteria = ?,
      pulled_notes = ?,
      death_dttm_source = ?,
      notes = ?,
      updated_at = datetime('now'),
      updated_by = ?
    WHERE id = ?`,
    args: [
      body.hospital_type || null,
      body.num_hospitals != null ? Number(body.num_hospitals) : null,
      body.icu_beds != null ? Number(body.icu_beds) : null,
      body.data_source || null,
      body.source_data_date_range || null,
      body.clifed_date_range || null,
      body.has_er_data ? 1 : 0,
      body.has_icu_data ? 1 : 0,
      body.has_ward_data ? 1 : 0,
      body.irb_name || null,
      body.irb_number || null,
      body.irb_approval_date || null,
      body.irb_approval_type || null,
      body.cohort_inclusion_criteria || null,
      body.pulled_notes || null,
      deathSource,
      body.notes || null,
      user.id,
      siteId,
    ],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
