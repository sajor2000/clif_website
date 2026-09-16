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
  purpose_detail: 'ATS 2026',
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
