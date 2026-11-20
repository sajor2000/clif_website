import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
vi.mock('./turso', () => ({ getDb: () => ({ execute }) }));

const { buildRunAuthorList, formatRunAuthors, orderRunAuthors, saveSiteAuthors, siteRoster } = await import(
  './project-run-authors'
);
const { POST: toggleSite } = await import('../pages/api/project-runs/toggle-site');
const { POST: setSiteNa } = await import('../pages/api/project-runs/set-site-na');

const member = (id: string, full_name: string, institution: string, extra = {}) => ({
  id,
  full_name,
  degrees: 'MD',
  affiliation: `Department of Medicine, ${institution}`,
  institution,
  email: `${id}@x.org`,
  ...extra,
});

const lead = member('lead', 'Lena Lead', 'Rush University');
const ann = member('ann', 'Ann Zimmer', 'Emory University');
const bob = member('bob', 'Bob Adams', 'Emory University');
const cat = member('cat', 'Cat Young', 'University of Chicago');
const members = [lead, ann, bob, cat];
const byId = new Map(members.map((m) => [m.id, m]));

const emory = { id: 's-emory', site_name: 'Emory', institution: 'Emory University' };
const uchicago = { id: 's-uc', site_name: 'University of Chicago', institution: null };
const sites = [uchicago, emory];

describe('siteRoster', () => {
  it('lists members whose institution is the site institution, by surname', () => {
    expect(siteRoster(emory, members).map((m) => m.id)).toEqual(['bob', 'ann']);
  });

  it('falls back to the site name and ignores case and spacing', () => {
    const spaced = member('dee', 'Dee Park', '  university of chicago ');
    expect(siteRoster(uchicago, [...members, spaced]).map((m) => m.id)).toEqual(['dee', 'cat']);
  });

  it("always includes the site's own editor", () => {
    expect(siteRoster(emory, members, 'cat').map((m) => m.id)).toEqual(['bob', 'cat', 'ann']);
  });

  it('matches no one for a site with no institution or name', () => {
    expect(siteRoster({ id: 'x', site_name: '', institution: null }, [member('n', 'No Inst', '')])).toEqual([]);
  });
});

describe('orderRunAuthors', () => {
  const picks = [
    { site_id: 's-uc', user_id: 'cat' },
    { site_id: 's-emory', user_id: 'ann' },
    { site_id: 's-emory', user_id: 'bob' },
  ];

  it('puts the lead first, then sites by name with people by surname', () => {
    expect(orderRunAuthors('lead', picks, sites, byId).map((m) => m.id)).toEqual(['lead', 'bob', 'ann', 'cat']);
  });

  it('lists a person once, at their first position', () => {
    const twice = [...picks, { site_id: 's-uc', user_id: 'ann' }, { site_id: 's-emory', user_id: 'lead' }];
    expect(orderRunAuthors('lead', twice, sites, byId).map((m) => m.id)).toEqual(['lead', 'bob', 'ann', 'cat']);
  });

  it('leaves out a lead or pick who is not an approved member', () => {
    const withGone = [...picks, { site_id: 's-emory', user_id: 'gone' }];
    expect(orderRunAuthors('shared-login', withGone, sites, byId).map((m) => m.id)).toEqual(['bob', 'ann', 'cat']);
  });
});

describe('buildRunAuthorList', () => {
  it('is empty until a site names someone', () => {
    expect(buildRunAuthorList('lead', [], sites, byId)).toEqual({ ids: [], text: '' });
  });

  it('formats with the Authorship Block defaults and credits the consortium last', () => {
    const list = buildRunAuthorList('lead', [{ site_id: 's-emory', user_id: 'ann' }], sites, byId);
    expect(list.ids).toEqual(['lead', 'ann']);
    expect(list.text).toBe(formatRunAuthors([lead, ann]));
    const byline = list.text.split('\n')[0];
    expect(byline.indexOf('Lena Lead')).toBeLessThan(byline.indexOf('Ann Zimmer'));
    expect(byline).toMatch(/and The Common Longitudinal ICU data Format \(CLIF\) Consortium$/);
    expect(list.text).toContain('1. Department of Medicine, Rush University');
    expect(list.text).toContain('2. Department of Medicine, Emory University');
  });
});

describe('saveSiteAuthors', () => {
  beforeEach(() => execute.mockReset().mockResolvedValue({ rows: [] }));

  it('replaces the site picks in one insert', async () => {
    await saveSiteAuthors('p1', 's-emory', ['ann', 'bob'], 'ann');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0][0].sql).toMatch(/^DELETE FROM project_run_site_authors/);
    expect(execute.mock.calls[0][0].args).toEqual(['p1', 's-emory']);
    const insert = execute.mock.calls[1][0];
    expect(insert.sql.match(/\(\?, \?, \?, \?, \?\)/g)).toHaveLength(2);
    expect(insert.args.slice(0, 4)).toEqual(['p1', 's-emory', 'ann', 'ann']);
    expect(insert.args.slice(5, 9)).toEqual(['p1', 's-emory', 'bob', 'ann']);
  });

  it('only deletes when the list is empty', async () => {
    await saveSiteAuthors('p1', 's-emory', [], 'ann');
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

// Route tests. `execute` answers by matching the SQL, so the order of queries
// inside the handlers is free to change.
type Db = { status?: string; editor?: boolean; picks?: { site_id: string; user_id: string }[] };

function scriptDb({ status = 'open', editor = true, picks = [] }: Db = {}) {
  execute.mockReset().mockImplementation(async (q: any) => {
    const sql: string = typeof q === 'string' ? q : q.sql;
    if (sql.includes('FROM project_runs')) return { rows: status ? [{ status, created_by: 'lead' }] : [] };
    if (sql.includes('FROM site_editors')) return { rows: editor ? [{ id: 'e1' }] : [] };
    if (sql.includes('FROM site_details')) return { rows: sites };
    if (sql.includes('FROM users'))
      return { rows: members.map((m) => ({ ...m, work_email: null })) };
    if (sql.startsWith('SELECT project_id, site_id, user_id'))
      return { rows: picks.map((p) => ({ project_id: 'p1', ...p })) };
    return { rows: [] };
  });
}

const writes = () =>
  execute.mock.calls
    .map((c) => (typeof c[0] === 'string' ? c[0] : c[0].sql).trim())
    .filter((sql) => /^(INSERT|DELETE|UPDATE)/.test(sql));

function call(route: typeof toggleSite, body: unknown, user: any = { id: 'ann', is_approved: true, role: 'member' }) {
  return route({
    locals: { user },
    request: new Request('https://clif-icu.com/api', { method: 'POST', body: JSON.stringify(body) }),
    url: new URL('https://clif-icu.com/api'),
  } as any);
}

describe('toggle-site', () => {
  const tick = { projectId: 'p1', siteId: 's-emory', hasRun: true };

  it('refuses to mark a site as run without an author', async () => {
    scriptDb();
    const res = await call(toggleSite, tick);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least one author/);
    expect(writes()).toEqual([]);
  });

  it('refuses an author from another site', async () => {
    scriptDb();
    const res = await call(toggleSite, { ...tick, authorIds: ['ann', 'cat'] });
    expect(res.status).toBe(400);
    expect(writes()).toEqual([]);
  });

  it('refuses a closed run', async () => {
    scriptDb({ status: 'closed' });
    const res = await call(toggleSite, { ...tick, authorIds: ['ann'] });
    expect(res.status).toBe(400);
    expect(writes()).toEqual([]);
  });

  it("refuses someone who is not the site's editor", async () => {
    scriptDb({ editor: false });
    const res = await call(toggleSite, { ...tick, authorIds: ['ann'] });
    expect(res.status).toBe(403);
    expect(writes()).toEqual([]);
  });

  it('saves the tick with its authors and returns the refreshed list', async () => {
    scriptDb({ picks: [{ site_id: 's-emory', user_id: 'ann' }, { site_id: 's-emory', user_id: 'bob' }] });
    const res = await call(toggleSite, { ...tick, authorIds: ['ann', 'bob', 'ann'] });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.siteAuthorIds).toEqual(['ann', 'bob']);
    expect(data.authorCount).toBe(3);
    expect(data.authorList.split('\n')[0]).toMatch(/^Lena Lead.*Bob Adams.*Ann Zimmer/);
    const w = writes();
    expect(w[0]).toMatch(/^INSERT INTO project_run_sites/);
    expect(w[1]).toMatch(/^DELETE FROM project_run_site_authors/);
    expect(w[2]).toMatch(/^INSERT INTO project_run_site_authors/);
  });

  it("lets a site's editor name themselves even with another profile institution", async () => {
    scriptDb();
    const res = await call(toggleSite, { ...tick, authorIds: ['cat'] }, { id: 'cat', is_approved: true, role: 'member' });
    expect(res.status).toBe(200);
  });

  it('gives an admin no such exception', async () => {
    scriptDb();
    const res = await call(toggleSite, { ...tick, authorIds: ['cat'] }, { id: 'cat', is_approved: true, role: 'admin' });
    expect(res.status).toBe(400);
  });

  it("removes the site's authors when it is unticked", async () => {
    scriptDb();
    const res = await call(toggleSite, { ...tick, hasRun: false, authorIds: ['ann'] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ siteAuthorIds: [], authorCount: 0, authorList: '' });
    const w = writes();
    expect(w).toHaveLength(2);
    expect(w[1]).toMatch(/^DELETE FROM project_run_site_authors/);
  });
});

describe('set-site-na', () => {
  it("removes the site's authors when it is marked N/A", async () => {
    scriptDb({ picks: [{ site_id: 's-uc', user_id: 'cat' }] });
    const res = await call(setSiteNa, { projectId: 'p1', siteId: 's-emory', notApplicable: true, reason: 'No ICU' });
    expect(res.status).toBe(200);
    expect(writes().some((sql) => sql.startsWith('DELETE FROM project_run_site_authors'))).toBe(true);
    expect((await res.json()).authorCount).toBe(2);
  });

  it('leaves authors alone when N/A is undone', async () => {
    scriptDb();
    const res = await call(setSiteNa, { projectId: 'p1', siteId: 's-emory', notApplicable: false });
    expect(res.status).toBe(200);
    expect(writes().some((sql) => sql.includes('project_run_site_authors'))).toBe(false);
  });
});
