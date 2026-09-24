export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { hospitalId } = body;

  if (!hospitalId) {
    return new Response(JSON.stringify({ error: 'hospitalId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const hospital = await db.execute({
    sql: 'SELECT site_id FROM hospitals WHERE id = ?',
    args: [hospitalId],
  });
  if (hospital.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Hospital not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check authorization: admin, or assigned editor of the hospital's site.
  // Hospitals without a linked site (e.g. MIMIC) are admin-only.
  if (user.role !== 'admin') {
    const siteId = hospital.rows[0].site_id;
    if (!siteId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
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

  const num = (v: unknown) => (v != null && v !== '' ? Number(v) : null);

  // The row's identity (unique per site_key) — blank rows are seeded for new
  // sites, so this is required as soon as anyone saves the row.
  const name = String(body.hospital_id_name ?? '').trim();
  if (!name) {
    return new Response(JSON.stringify({ error: 'Hospital name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await db.execute({
      sql: `UPDATE hospitals SET
      hospital_id_name = ?,
      hospital_full_name = ?,
      hospital_id = ?,
      hospital_number = ?,
      ccn = ?,
      zipcode = ?,
      hospital_type = ?,
      rt_vent_protocol = ?,
      num_icus = ?,
      icu_beds = ?,
      region = ?,
      lttv_proportion = ?,
      vent_patient_hours = ?,
      vent_patients = ?,
      vent_encounters = ?,
      updated_at = datetime('now'),
      updated_by = ?
    WHERE id = ?`,
      args: [
        name,
        body.hospital_full_name || null,
        body.hospital_id || null,
        num(body.hospital_number),
        body.ccn || null,
        body.zipcode || null,
        body.hospital_type || null,
        body.rt_vent_protocol || null,
        num(body.num_icus),
        body.icu_beds || null,
        body.region || null,
        num(body.lttv_proportion),
        num(body.vent_patient_hours),
        num(body.vent_patients),
        num(body.vent_encounters),
        user.id,
        hospitalId,
      ],
    });
  } catch (e: any) {
    // idx_hospitals_site_name keeps (site_key, hospital_id_name) unique.
    if (String(e?.message || '').includes('UNIQUE constraint failed')) {
      return new Response(
        JSON.stringify({ error: `This site already has a hospital named "${name}"` }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw e;
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
