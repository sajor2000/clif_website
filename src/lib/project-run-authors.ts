// Authors on a project run.
//
// When a site marks a run as run on the tracker, the person ticking the box
// names the authors from that site (migrations/030). A run's author list is
// then built automatically: the run's creator first, then each site's picks
// (sites by name, people by surname), then the CLIF Consortium group author.
// Formatting is the Authorship Block's (./format-byline).

import { getDb } from './turso';
import {
  CLIF_CONSORTIUM_AUTHOR,
  buildAffiliationRegistry,
  format,
  parseName,
  renderFull,
  type AuthorInput,
} from './format-byline';

// The shared consortium admin login isn't a person. The consortium is credited
// as a group author instead (CLIF_CONSORTIUM_AUTHOR).
export const CONSORTIUM_LOGIN_EMAIL = 'clifconsortium@gmail.com';

// A site can name at most this many authors on one run.
export const MAX_SITE_AUTHORS = 50;

export interface AuthorMember {
  id: string;
  full_name: string;
  degrees: string;
  affiliation: string;
  institution: string;
  // Public-facing email (work email when set).
  email: string;
}

export interface AuthorSite {
  id: string;
  site_name: string;
  institution: string | null;
}

export interface SitePick {
  project_id: string;
  site_id: string;
  user_id: string;
}

function norm(s: string | null | undefined): string {
  return String(s || '').trim().toLowerCase();
}

function bySurname(a: AuthorMember, b: AuthorMember): number {
  const la = parseName(a.full_name).last;
  const lb = parseName(b.full_name).last;
  return la.localeCompare(lb, 'en', { sensitivity: 'base' }) || a.full_name.localeCompare(b.full_name);
}

/**
 * Members a site may name as authors: approved members whose profile
 * institution is the site's institution or site name. `alwaysInclude` adds one
 * more person regardless of institution: the site's own data editor, so they
 * can always name themselves.
 */
export function siteRoster(site: AuthorSite, members: AuthorMember[], alwaysInclude?: string): AuthorMember[] {
  const keys = new Set([norm(site.institution), norm(site.site_name)].filter(Boolean));
  return members
    .filter((m) => m.id === alwaysInclude || keys.has(norm(m.institution)))
    .sort(bySurname);
}

/**
 * The run's authors in order: the lead (the run's creator) first, then each
 * site's picks grouped by site (sites by name, people by surname). A person
 * who appears twice is listed once, at their first position. People who are no
 * longer approved members are left out.
 */
export function orderRunAuthors(
  leadId: string | null,
  picks: Pick<SitePick, 'site_id' | 'user_id'>[],
  sites: AuthorSite[],
  members: Map<string, AuthorMember>,
): AuthorMember[] {
  const out: AuthorMember[] = [];
  const seen = new Set<string>();
  const add = (id: string | null) => {
    const m = id ? members.get(id) : undefined;
    if (!m || seen.has(m.id)) return;
    seen.add(m.id);
    out.push(m);
  };

  add(leadId);
  const siteName = new Map(sites.map((s) => [s.id, s.site_name]));
  const bySite = new Map<string, AuthorMember[]>();
  for (const p of picks) {
    const m = members.get(p.user_id);
    if (!m) continue;
    if (!bySite.has(p.site_id)) bySite.set(p.site_id, []);
    bySite.get(p.site_id)!.push(m);
  }
  const siteIds = [...bySite.keys()].sort((a, b) =>
    (siteName.get(a) || '').localeCompare(siteName.get(b) || '', 'en', { sensitivity: 'base' }),
  );
  for (const id of siteIds) bySite.get(id)!.sort(bySurname).forEach((m) => add(m.id));
  return out;
}

/** The formatted author block (Vancouver, numbered affiliations, consortium last). */
export function formatRunAuthors(authors: AuthorMember[]): string {
  if (authors.length === 0) return '';
  const inputs: AuthorInput[] = authors.map((m) => ({
    id: m.id,
    full_name: m.full_name,
    degrees: m.degrees,
    affiliation: m.affiliation,
    email: m.email,
  }));
  const registry = buildAffiliationRegistry(inputs);
  return renderFull(format('vancouver', [...inputs, CLIF_CONSORTIUM_AUTHOR], registry));
}

export async function loadAuthorMembers(): Promise<AuthorMember[]> {
  const res = await getDb().execute({
    sql: `SELECT id, full_name, degrees, affiliation, institution, work_email, email
          FROM users
          WHERE is_approved = 1 AND LOWER(email) != ?
          ORDER BY full_name`,
    args: [CONSORTIUM_LOGIN_EMAIL],
  });
  return (res.rows as any[]).map((r) => ({
    id: String(r.id),
    full_name: r.full_name || '',
    degrees: r.degrees || '',
    affiliation: r.affiliation || '',
    institution: r.institution || '',
    email: r.work_email || r.email || '',
  }));
}

/** Every site's picks, for one run or (no argument) for all runs. */
export async function loadSitePicks(projectId?: string): Promise<SitePick[]> {
  const res = await getDb().execute({
    sql: `SELECT project_id, site_id, user_id FROM project_run_site_authors${projectId ? ' WHERE project_id = ?' : ''}`,
    args: projectId ? [projectId] : [],
  });
  return (res.rows as any[]).map((r) => ({
    project_id: String(r.project_id),
    site_id: String(r.site_id),
    user_id: String(r.user_id),
  }));
}

export interface RunAuthorList {
  // Ordered author ids (people only, without the consortium group author).
  ids: string[];
  text: string;
}

/** One run's ordered, formatted author list. Empty until a site names someone. */
export function buildRunAuthorList(
  leadId: string | null,
  picks: Pick<SitePick, 'site_id' | 'user_id'>[],
  sites: AuthorSite[],
  members: Map<string, AuthorMember>,
): RunAuthorList {
  if (picks.length === 0) return { ids: [], text: '' };
  const authors = orderRunAuthors(leadId, picks, sites, members);
  return { ids: authors.map((a) => a.id), text: formatRunAuthors(authors) };
}

/** Replace a site's authors on a run. An empty list clears them. */
export async function saveSiteAuthors(
  projectId: string,
  siteId: string,
  userIds: string[],
  actorId: string,
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM project_run_site_authors WHERE project_id = ? AND site_id = ?',
    args: [projectId, siteId],
  });
  if (userIds.length === 0) return;
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO project_run_site_authors (project_id, site_id, user_id, added_by, added_at)
          VALUES ${userIds.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
    args: userIds.flatMap((id) => [projectId, siteId, id, actorId, now]),
  });
}
