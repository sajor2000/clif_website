import { beforeEach, describe, expect, it, vi } from 'vitest';

// The job's two moving parts are mocked: the database (one execute mock,
// scripted per test) and the Slack webhook. Everything in between -- which
// runs qualify, who is pending, what gets recorded -- is exercised for real.
const execute = vi.fn();
const post = vi.fn();

vi.mock('./turso', () => ({ getDb: () => ({ execute }) }));
vi.mock('./slack', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./slack')>()),
  postSlackMessage: post,
}));

const { sendDeadlineReminders } = await import('./project-run-reminders');
const { buildDeadlineReminderSlackMessage } = await import('./slack');

// 2026-10-20 09:00 Chicago (CDT). The sample run is due a week later.
const now = new Date('2026-10-20T14:00:00Z');
const run = {
  id: 'run1',
  project_number: 20,
  run_number: 1,
  title: 'CLIF Hospice Characterization',
  results_deadline: '2026-10-27',
  conference: 'ATS 2027',
  requester_name: 'Brenna Park-Egan',
  requester_email: null,
};
const sites = [
  { id: 's1', site_name: 'Emory University' },
  { id: 's2', site_name: 'Rush University' },
  { id: 's3', site_name: 'University of Chicago' },
  { id: 's4', site_name: 'Northwestern University' },
  // Not yet running any project: never pending, never counted.
  { id: 's5', site_name: 'Yale University' },
];

// Scripts the query sequence for a single qualifying run: runs, sites, the
// windows already sent for it, its per-site statuses, then any inserts.
function script(runs: unknown[], opts: { sent?: number[]; statuses?: unknown[] } = {}) {
  execute
    .mockResolvedValueOnce({ rows: runs })
    .mockResolvedValueOnce({ rows: sites })
    .mockResolvedValueOnce({ rows: (opts.sent ?? []).map((days_before) => ({ days_before })) })
    .mockResolvedValueOnce({ rows: opts.statuses ?? [] })
    .mockResolvedValue({ rowsAffected: 1 });
}

function inserts() {
  return execute.mock.calls
    .map((c) => c[0])
    .filter((q) => typeof q === 'object' && /INSERT OR IGNORE INTO project_run_reminders/.test(q.sql))
    .map((q) => q.args);
}

beforeEach(() => {
  execute.mockReset();
  post.mockReset();
  post.mockResolvedValue({ ok: true });
});

describe('sendDeadlineReminders', () => {
  it('looks for open runs due within the week', async () => {
    execute.mockResolvedValueOnce({ rows: [] });
    const result = await sendDeadlineReminders('https://clif-icu.com', now);
    expect(result).toEqual({ today: '2026-10-20', reminders: [] });
    const q = execute.mock.calls[0][0];
    expect(q.args).toEqual(['2026-10-20', '2026-10-27']);
    expect(q.sql).toMatch(/status = 'open'/);
    expect(post).not.toHaveBeenCalled();
  });

  it('posts the progress and pending sites a week out, then records the 7-day window', async () => {
    script([run], {
      statuses: [
        { site_id: 's1', has_run: 1, not_applicable: 0 },
        { site_id: 's4', has_run: 0, not_applicable: 1 },
        { site_id: 's5', has_run: 1, not_applicable: 0 }, // excluded site: ignored even if ticked
      ],
    });
    const { reminders } = await sendDeadlineReminders('https://clif-icu.com', now);

    expect(reminders).toEqual([
      expect.objectContaining({
        id: 'run1',
        daysLeft: 7,
        ran: 1,
        applicable: 3,
        pending: ['Rush University', 'University of Chicago'],
        posted: true,
      }),
    ]);

    const payload = post.mock.calls[0][0] as { text: string; blocks: unknown[] };
    expect(payload.text).toBe(
      'Box upload deadline in 7 days: CLIF Hospice Characterization — 1/3 sites have run it, 2 pending',
    );
    const body = JSON.stringify(payload.blocks);
    expect(body).toContain('<!channel> :hourglass_flowing_sand: *Box upload deadline in 7 days*');
    expect(body).toContain('*1 / 3 sites* have run this (1 N/A)');
    expect(body).toContain('*Still pending (2):* Rush University, University of Chicago');
    expect(body).not.toContain('Yale');
    expect(body).toContain('20. CLIF Hospice Characterization');
    expect(body).toContain('Oct 27, 2026');

    expect(inserts()).toEqual([['run1', '2026-10-27', 7]]);
  });

  it('posts again the day before, once the 7-day reminder is on record', async () => {
    const dayBefore = new Date('2026-10-26T14:00:00Z');
    script([run], { sent: [7] });
    const { reminders } = await sendDeadlineReminders('https://clif-icu.com', dayBefore);
    expect(reminders[0]).toMatchObject({ daysLeft: 1, posted: true });
    expect(JSON.stringify(post.mock.calls[0][0])).toContain(':rotating_light: *Box upload deadline tomorrow*');
    expect(inserts()).toEqual([['run1', '2026-10-27', 1]]);
  });

  it('stays quiet on the days in between', async () => {
    script([run], { sent: [7] });
    await sendDeadlineReminders('https://clif-icu.com', new Date('2026-10-23T14:00:00Z'));
    expect(post).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(3); // never even fetched site statuses
  });

  it('sends one post that satisfies every window a run is already inside', async () => {
    // Deadline tomorrow, nothing sent yet (e.g. run created mid-week).
    script([run], {});
    await sendDeadlineReminders('https://clif-icu.com', new Date('2026-10-26T14:00:00Z'));
    expect(post).toHaveBeenCalledTimes(1);
    expect(inserts()).toEqual([
      ['run1', '2026-10-27', 7],
      ['run1', '2026-10-27', 1],
    ]);
  });

  it('says nothing when every applicable site has already run it', async () => {
    script([run], {
      statuses: [
        { site_id: 's1', has_run: 1, not_applicable: 0 },
        { site_id: 's2', has_run: 1, not_applicable: 0 },
        { site_id: 's3', has_run: 1, not_applicable: 0 },
        { site_id: 's4', has_run: 0, not_applicable: 1 },
      ],
    });
    const { reminders } = await sendDeadlineReminders('https://clif-icu.com', now);
    expect(reminders[0]).toMatchObject({ ran: 3, applicable: 3, pending: [], posted: false });
    expect(post).not.toHaveBeenCalled();
    expect(inserts()).toEqual([]);
  });

  it('does not record a reminder the webhook rejected, so tomorrow retries', async () => {
    script([run], {});
    post.mockResolvedValue({ ok: false, error: 'SLACK_WEBHOOK_URL not configured' });
    const { reminders } = await sendDeadlineReminders('https://clif-icu.com', now);
    expect(reminders[0]).toMatchObject({ posted: false, error: 'SLACK_WEBHOOK_URL not configured' });
    expect(reminders[0].pending).toHaveLength(4); // the four ready sites, not Yale
    expect(inserts()).toEqual([]);
  });
});

describe('buildDeadlineReminderSlackMessage', () => {
  const base = {
    projectNumber: 7,
    runNumber: 2,
    title: 'Sepsis <phenotypes> & more',
    deadline: '2026-10-21',
    daysLeft: 1,
    conference: null,
    requestedBy: null,
    ranCount: 0,
    applicableCount: 2,
    naCount: 0,
    pendingSites: ['A & B', 'C'],
    projectUrl: 'https://clif-icu.com/portal/project-runs',
  };

  it('phrases the heading by days left and labels reruns', () => {
    const body = JSON.stringify(buildDeadlineReminderSlackMessage(base).blocks);
    expect(body).toContain('*Box upload deadline tomorrow*');
    expect(body).toContain('7 (run 2). Sepsis &lt;phenotypes&gt; &amp; more');
    expect(body).toContain('*Still pending (2):* A &amp; B, C');
    expect(body).not.toContain('N/A');

    expect(JSON.stringify(buildDeadlineReminderSlackMessage({ ...base, daysLeft: 0 }))).toContain('deadline today');
    expect(JSON.stringify(buildDeadlineReminderSlackMessage({ ...base, daysLeft: 5 }))).toContain('deadline in 5 days');
  });
});
