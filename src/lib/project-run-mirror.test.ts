import { beforeEach, describe, expect, it, vi } from 'vitest';

// The weekly repo-mirror job (a GitHub Action in the org's .github repo) talks
// to two routes. These tests pin down the contract: only the dedicated token
// gets in, a mirrored run leaves the queue for good, and a skip is emailed
// once, not every week.
const execute = vi.fn();
const sendEmail = vi.fn((..._args: unknown[]) => Promise.resolve({ ok: true }));

vi.mock('./turso', () => ({ getDb: () => ({ execute }) }));
vi.mock('./email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./email')>()),
  sendEmail,
}));

const { GET: queue } = await import('../pages/api/project-runs/mirror-queue');
const { POST: results } = await import('../pages/api/project-runs/mirror-results');
const { buildMirrorSkipReportEmail } = await import('./email');
const { parseMirrorResults } = await import('./project-run-mirror');

const TOKEN = 'test-mirror-token';
const ORG = 'https://github.com/Common-Longitudinal-ICU-data-Format';

function call(route: typeof queue, opts: { token?: string | null; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? TOKEN}`;
  return route({
    request: new Request('https://clif-icu.com/api', {
      method: opts.body === undefined ? 'GET' : 'POST',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
  } as any);
}

beforeEach(() => {
  execute.mockReset();
  sendEmail.mockClear();
  process.env.MIRROR_SYNC_TOKEN = TOKEN;
});

describe('auth', () => {
  it('rejects a missing or wrong token on both routes without touching the database', async () => {
    expect((await call(queue, { token: null })).status).toBe(401);
    expect((await call(queue, { token: 'nope' })).status).toBe(401);
    expect((await call(results, { token: 'nope', body: { results: [] } })).status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses to run when the token is not configured', async () => {
    delete process.env.MIRROR_SYNC_TOKEN;
    expect((await call(queue)).status).toBe(500);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('mirror-queue', () => {
  it('asks only for closed runs with a repo link and no org copy', async () => {
    execute.mockResolvedValueOnce({
      rows: [{ id: 'r1', project_number: 7, run_number: 1, title: 'Sepsis', repo_url: 'https://github.com/x/y', mirror_note: null }],
    });
    const res = await call(queue);
    expect(res.status).toBe(200);
    expect((await res.json()).runs).toEqual([
      { id: 'r1', project_number: 7, run_number: 1, title: 'Sepsis', repo_url: 'https://github.com/x/y', mirror_note: null },
    ]);
    const sql = execute.mock.calls[0][0].sql as string;
    expect(sql).toContain("status = 'closed'");
    expect(sql).toContain('mirror_url IS NULL');
  });
});

describe('mirror-results', () => {
  it('records a mirrored run and sends no email', async () => {
    execute.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
    const res = await call(results, {
      body: { results: [{ id: 'r1', title: 'Sepsis', repo_url: 'https://github.com/x/y', outcome: 'mirrored', mirror_url: `${ORG}/y` }] },
    });
    expect(await res.json()).toMatchObject({ success: true, recorded: 1, skipsReported: 0, emailed: false });
    expect(execute.mock.calls[0][0].args).toEqual([`${ORG}/y`, 'r1']);
    expect(execute.mock.calls[0][0].sql).toContain('mirror_url IS NULL');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('emails a skip the first time and stays quiet when the same reason comes back', async () => {
    const skip = { id: 'r2', title: 'Private one', repo_url: 'https://github.com/a/b', outcome: 'skipped', reason: 'private or not found' };

    execute.mockResolvedValueOnce({ rows: [{ id: 'r2' }] }); // note was new
    expect(await (await call(results, { body: { results: [skip] } })).json()).toMatchObject({ skipsReported: 1, emailed: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toBe('clif_consortium@uchicago.edu');

    execute.mockResolvedValueOnce({ rows: [] }); // same note as last week
    expect(await (await call(results, { body: { results: [skip] } })).json()).toMatchObject({ skipsReported: 0, emailed: false });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('always reports a skip that has no tracker row (backfill)', async () => {
    const res = await call(results, {
      body: { results: [{ title: 'Old project', repo_url: 'https://github.com/a/b', outcome: 'skipped', reason: 'uses Git LFS' }] },
    });
    expect(await res.json()).toMatchObject({ skipsReported: 1 });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a link that is not in the CLIF org', async () => {
    const res = await call(results, {
      body: { results: [{ id: 'r1', title: 'Sepsis', repo_url: 'https://github.com/x/y', outcome: 'mirrored', mirror_url: 'https://github.com/evil/y' }] },
    });
    expect(res.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('parseMirrorResults', () => {
  it('requires a reason for a skip and a known outcome', () => {
    expect(parseMirrorResults({ results: [{ title: 't', repo_url: 'u', outcome: 'skipped' }] })).toHaveProperty('error');
    expect(parseMirrorResults({ results: [{ title: 't', repo_url: 'u', outcome: 'deleted' }] })).toHaveProperty('error');
    expect(parseMirrorResults({})).toHaveProperty('error');
  });
});

describe('buildMirrorSkipReportEmail', () => {
  it('escapes project text', () => {
    const html = buildMirrorSkipReportEmail([{ title: '<b>x</b>', repo_url: 'https://github.com/a/b', reason: 'private & hidden' }]);
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('private &amp; hidden');
  });
});
