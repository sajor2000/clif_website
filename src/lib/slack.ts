/**
 * Slack notifications via an Incoming Webhook.
 *
 * The consortium already announces new runs by hand in #run_requests (see
 * clif-101). This posts the same announcement automatically the moment a
 * request is filed.
 *
 * Configure SLACK_WEBHOOK_URL (Slack app -> Incoming Webhooks -> add to
 * #run_requests). The webhook URL is bound to one channel at creation time;
 * pointing this at a different channel means issuing a new URL. With the var
 * unset every call is a no-op, so local dev and previews stay silent.
 */

import { PURPOSE_LABELS, isRerun, runLabel } from './project-run-status';

export interface ProjectRunSlackInput {
  projectNumber: number | null;
  /** 1 for an original run; 2+ marks a rerun of the same project. */
  runNumber?: number | null;
  title: string;
  description: string | null;
  purpose: string | null;
  purposeDetail: string | null;
  deadline: string | null;
  /** Conference tag, e.g. 'ATS 2027'. */
  conference?: string | null;
  requestedBy: string | null;
  projectUrl: string;
}

/** Slack mrkdwn requires exactly these three characters to be escaped. */
function escapeSlack(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

// Deadlines are stored as plain YYYY-MM-DD; render in UTC so the date can't
// slip a day for members west of the line.
function formatDeadline(deadline: string): string {
  const d = new Date(deadline.length <= 10 ? deadline + 'T12:00:00Z' : deadline);
  if (isNaN(d.getTime())) return deadline;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Block Kit payload announcing a new project run request. */
export function buildProjectRunSlackMessage(r: ProjectRunSlackInput): Record<string, unknown> {
  const rerun = isRerun(r.runNumber);
  const numPrefix = r.projectNumber != null ? `${runLabel(r.projectNumber, r.runNumber)}. ` : '';
  const heading = rerun ? 'Project rerun request' : 'New project run request';
  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        // <!channel> is Slack's raw token for @channel -- it notifies every
        // member of #run_requests, including those currently offline. Written
        // literally (not "@channel"), which would render as plain text.
        text: `<!channel> :bell: *${heading}*\n<${r.projectUrl}|${escapeSlack(numPrefix + r.title)}>`,
      },
    },
  ];

  if (r.description) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: truncate(escapeSlack(r.description), 600) },
    });
  }

  const bits: string[] = [];
  if (r.requestedBy) bits.push(`Requested by *${escapeSlack(r.requestedBy)}*`);
  const label = r.purpose ? (PURPOSE_LABELS[r.purpose] ?? r.purpose) : null;
  if (label) {
    bits.push(escapeSlack(label + (r.purposeDetail ? ` — ${r.purposeDetail}` : '')));
  }
  if (r.conference) bits.push(`*${escapeSlack(r.conference)}*`);
  if (r.deadline) bits.push(`Box upload deadline *${formatDeadline(r.deadline)}*`);
  if (bits.length) {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: bits.join('  ·  ') }] });
  }

  // The portal is the only way out of this message -- no repo or Box buttons.
  // Members must land on the tracker, where the instructions and the "has run"
  // checkbox live, rather than jumping straight to code or a folder.
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View in portal' },
        url: r.projectUrl,
        style: 'primary',
      },
    ],
  });

  return {
    // Fallback used for push/desktop notifications and any client that can't
    // render blocks — without it Slack shows an empty alert.
    text: `${heading}: ${r.title}`,
    blocks,
  };
}

export interface DeadlineReminderSlackInput {
  projectNumber: number | null;
  runNumber?: number | null;
  title: string;
  /** YYYY-MM-DD Box upload deadline. */
  deadline: string;
  /** Whole days from today (Chicago) to the deadline; 0 = due today. */
  daysLeft: number;
  conference?: string | null;
  requestedBy: string | null;
  /** Sites that have ticked "has run". */
  ranCount: number;
  /** Sites owed the run: every site minus those marked N/A. */
  applicableCount: number;
  naCount: number;
  /** Names of the sites that have neither run it nor been marked N/A. */
  pendingSites: string[];
  projectUrl: string;
}

function dueIn(daysLeft: number): string {
  if (daysLeft <= 0) return 'today';
  if (daysLeft === 1) return 'tomorrow';
  return `in ${daysLeft} days`;
}

/**
 * Block Kit payload reminding #run_requests that a run's Box upload deadline
 * is close: progress so far and the sites that still owe it. Posted a week
 * out and a day out by /api/project-runs/deadline-reminder.
 */
export function buildDeadlineReminderSlackMessage(r: DeadlineReminderSlackInput): Record<string, unknown> {
  const numPrefix = r.projectNumber != null ? `${runLabel(r.projectNumber, r.runNumber)}. ` : '';
  const heading = `Box upload deadline ${dueIn(r.daysLeft)}`;
  const pendingList = r.pendingSites.map(escapeSlack).join(', ');
  // Distinct from the :bell: on a new-run announcement: an hourglass a week
  // out, a rotating light when it's down to the last day.
  const icon = r.daysLeft <= 1 ? ':rotating_light:' : ':hourglass_flowing_sand:';

  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<!channel> ${icon} *${heading}*\n<${r.projectUrl}|${escapeSlack(numPrefix + r.title)}>`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `*${r.ranCount} / ${r.applicableCount} sites* have run this` +
          (r.naCount > 0 ? ` (${r.naCount} N/A)` : '') +
          `\n*Still pending (${r.pendingSites.length}):* ${pendingList}`,
      },
    },
  ];

  const bits: string[] = [`Box upload deadline *${formatDeadline(r.deadline)}*`];
  if (r.conference) bits.push(`*${escapeSlack(r.conference)}*`);
  if (r.requestedBy) bits.push(`Requested by *${escapeSlack(r.requestedBy)}*`);
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: bits.join('  ·  ') }] });

  // Same single exit as the announcement: the tracker is where the "has run"
  // checkbox lives.
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View in portal' },
        url: r.projectUrl,
        style: 'primary',
      },
    ],
  });

  return {
    text: `${heading}: ${r.title} — ${r.ranCount}/${r.applicableCount} sites have run it, ${r.pendingSites.length} pending`,
    blocks,
  };
}

/** POST a payload to the configured webhook. Never throws. */
export async function postSlackMessage(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  // Astro/Vite puts .env values on import.meta.env (dev); Vercel puts them on
  // process.env (prod). The `?.` matters: import.meta.env only exists under
  // Vite, so without it this module throws anywhere else — including tests.
  const webhookUrl = import.meta.env?.SLACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false, error: 'SLACK_WEBHOOK_URL not configured' };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // Slack returns a plain-text reason (e.g. "invalid_payload", "no_service").
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `Slack webhook error ${res.status}: ${detail}`.trim() };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Slack request failed' };
  }
}

/** Announce a new project run request in the configured channel. */
export async function notifySlackProjectRun(
  r: ProjectRunSlackInput,
): Promise<{ ok: boolean; error?: string }> {
  return postSlackMessage(buildProjectRunSlackMessage(r));
}
