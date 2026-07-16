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

// Mirrors the labels shown on /portal/project-runs. Kept local so lib/ doesn't
// have to import from a page module.
const PURPOSE_LABELS: Record<string, string> = {
  grant: 'Grant',
  conference: 'Conference / Abstract',
  journal: 'Journal / Manuscript',
  other: 'Exploratory / Other',
};

export interface ProjectRunSlackInput {
  projectNumber: number | null;
  title: string;
  description: string | null;
  purpose: string | null;
  purposeDetail: string | null;
  deadline: string | null;
  requestedBy: string | null;
  repoUrl: string | null;
  boxFolderUrl: string | null;
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
  const numPrefix = r.projectNumber != null ? `${r.projectNumber}. ` : '';
  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:bell: *New project run request*\n<${r.projectUrl}|${escapeSlack(numPrefix + r.title)}>`,
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
  if (r.deadline) bits.push(`Box upload deadline *${formatDeadline(r.deadline)}*`);
  if (bits.length) {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: bits.join('  ·  ') }] });
  }

  // Slack rejects a button whose url isn't http(s), so only trusted links pass.
  const isHttp = (u: string | null): u is string => !!u && /^https?:\/\//i.test(u);
  const actions: Record<string, unknown>[] = [
    {
      type: 'button',
      text: { type: 'plain_text', text: 'View in portal' },
      url: r.projectUrl,
      style: 'primary',
    },
  ];
  if (isHttp(r.repoUrl)) {
    actions.push({ type: 'button', text: { type: 'plain_text', text: 'Repo' }, url: r.repoUrl });
  }
  if (isHttp(r.boxFolderUrl)) {
    actions.push({ type: 'button', text: { type: 'plain_text', text: 'Box folder' }, url: r.boxFolderUrl });
  }
  blocks.push({ type: 'actions', elements: actions });

  return {
    // Fallback used for push/desktop notifications and any client that can't
    // render blocks — without it Slack shows an empty alert.
    text: `New project run request: ${r.title}`,
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
