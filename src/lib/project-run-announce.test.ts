import { beforeEach, describe, expect, it, vi } from 'vitest';

// Slack posts and member emails both go through announceProjectRun. These
// tests pin down when it fires: a run sites can act on (created open, or an
// upcoming run launched) is announced; saving an upcoming run is not.
const announce = vi.fn(() => Promise.resolve());
const execute = vi.fn();

vi.mock('./notify-project-run', () => ({ announceProjectRun: announce }));
vi.mock('./turso', () => ({ getDb: () => ({ execute }) }));

const { POST: create } = await import('../pages/api/project-runs/create');
const { POST: launch } = await import('../pages/api/project-runs/launch');
const { runnableTables } = await import('../data/clif-tables');

const user = { id: 'u1', is_approved: true, role: 'member', full_name: 'Tester', email: 't@x.org' };
const fields = {
  title: 'Sepsis phenotypes',
  repo_url: 'https://github.com/x/y',
  box_folder_url: 'https://box.com/f',
  description: 'Short summary',
  instructions: 'Run it',
  purpose: 'conference',
  purpose_detail: 'ATS 2027',
  results_deadline: '2099-01-01',
  clif_version: '2.1',
  required_tables: [runnableTables('2.1')[0]],
  prelim_shared: true,
  prelim_link: 'https://example.org/prelim',
};

function call(route: typeof create, body: unknown) {
  return route({
    locals: { user },
    request: new Request('https://clif-icu.com/api', { method: 'POST', body: JSON.stringify(body) }),
    url: new URL('https://clif-icu.com/api'),
  } as any);
}

beforeEach(() => {
  announce.mockClear();
  execute.mockReset();
});

describe('create', () => {
  beforeEach(() => {
    execute.mockResolvedValue({ rows: [{ id: 'run1', project_number: 7 }] });
  });

  it('does not announce an upcoming run', async () => {
    const res = await call(create, { ...fields, repo_url: '', box_folder_url: '', status: 'upcoming', notify_all: true });
    expect(res.status).toBe(200);
    expect(execute.mock.calls[0][0].args).toContain('upcoming');
    expect(announce).not.toHaveBeenCalled();
  });

  it('announces a run created ready to go', async () => {
    const res = await call(create, { ...fields, notify_all: false });
    expect(res.status).toBe(200);
    expect(execute.mock.calls[0][0].args).toContain('open');
    expect(announce).toHaveBeenCalledWith('run1', expect.objectContaining({ notifyAll: false }));
  });

  it('rejects an open run missing its repo without announcing', async () => {
    const res = await call(create, { ...fields, repo_url: '' });
    expect(res.status).toBe(400);
    expect(announce).not.toHaveBeenCalled();
  });
});

describe('create a rerun', () => {
  const previous = (over: Record<string, unknown> = {}) => ({
    rows: [{ id: 'run1', project_number: 7, run_number: 1, status: 'open', created_by: 'u1', latest_run: 1, ...over }],
  });
  const inserted = { rows: [{ id: 'run2', project_number: 7, run_number: 2 }] };

  it('numbers the rerun under the same project and closes the previous run on request', async () => {
    execute.mockResolvedValueOnce(previous()).mockResolvedValueOnce(inserted).mockResolvedValueOnce({ rowsAffected: 1 });
    const res = await call(create, { ...fields, rerun_of: 'run1', close_previous: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ project_number: 7, run_number: 2 });
    const insert = execute.mock.calls[1][0];
    expect(insert.sql).toMatch(/MAX\(run_number\)/);
    expect(insert.args.slice(-2)).toEqual([7, 7]);
    const close = execute.mock.calls[2][0];
    expect(close.sql).toMatch(/status = 'closed'/);
    expect(close.args).toContain('run1');
    expect(announce).toHaveBeenCalledWith('run2', expect.anything());
  });

  it('leaves the previous run alone unless asked', async () => {
    execute.mockResolvedValueOnce(previous()).mockResolvedValueOnce(inserted);
    const res = await call(create, { ...fields, rerun_of: 'run1', close_previous: false });
    expect(res.status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('never closes a previous run that is already closed', async () => {
    execute.mockResolvedValueOnce(previous({ status: 'closed' })).mockResolvedValueOnce(inserted);
    const res = await call(create, { ...fields, rerun_of: 'run1', close_previous: true });
    expect(res.status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('rejects a rerun of an upcoming run, a stale run, or someone else’s project', async () => {
    execute.mockResolvedValueOnce(previous({ status: 'upcoming' }));
    expect((await call(create, { ...fields, rerun_of: 'run1' })).status).toBe(400);

    execute.mockResolvedValueOnce(previous({ latest_run: 2 }));
    expect((await call(create, { ...fields, rerun_of: 'run1' })).status).toBe(400);

    execute.mockResolvedValueOnce(previous({ created_by: 'someone-else' }));
    expect((await call(create, { ...fields, rerun_of: 'run1' })).status).toBe(403);

    execute.mockResolvedValueOnce({ rows: [] });
    expect((await call(create, { ...fields, rerun_of: 'missing' })).status).toBe(404);
    expect(announce).not.toHaveBeenCalled();
  });
});

describe('launch', () => {
  const upcomingRow = { rows: [{ created_by: 'u1', status: 'upcoming', conference: null }] };

  it('announces once the run launches', async () => {
    execute.mockResolvedValueOnce(upcomingRow).mockResolvedValueOnce({ rowsAffected: 1 });
    const res = await call(launch, { ...fields, projectId: 'run1', notify_all: true });
    expect(res.status).toBe(200);
    expect(announce).toHaveBeenCalledWith('run1', expect.objectContaining({ notifyAll: true }));
  });

  it('rejects a launch missing required fields without announcing', async () => {
    execute.mockResolvedValueOnce(upcomingRow);
    const res = await call(launch, { ...fields, projectId: 'run1', box_folder_url: '' });
    expect(res.status).toBe(400);
    expect(announce).not.toHaveBeenCalled();
  });

  it('does not re-announce a run that is already open', async () => {
    execute.mockResolvedValueOnce({ rows: [{ created_by: 'u1', status: 'open', conference: null }] });
    const res = await call(launch, { ...fields, projectId: 'run1' });
    expect(res.status).toBe(400);
    expect(announce).not.toHaveBeenCalled();
  });
});
