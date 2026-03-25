export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { hasRole } from '../../../lib/roles';

const GITHUB_REPO = 'clif-consortium/CLIF';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user || !hasRole(locals.user.role, 'steering')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { proposalId } = await request.json();

  if (!proposalId) {
    return new Response(JSON.stringify({ error: 'proposalId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  const now = new Date().toISOString();

  // Close the proposal
  await db.execute({
    sql: "UPDATE proposals SET status = 'closed', updated_at = ? WHERE id = ?",
    args: [now, proposalId],
  });

  // Check vote tally — create GitHub issue if yes > no
  let issueUrl: string | null = null;
  try {
    const proposal = await db.execute({
      sql: 'SELECT title, description FROM proposals WHERE id = ?',
      args: [proposalId],
    });
    const votes = await db.execute({
      sql: `SELECT
              SUM(CASE WHEN vote = 'yes' THEN 1 ELSE 0 END) as yes_count,
              SUM(CASE WHEN vote = 'no' THEN 1 ELSE 0 END) as no_count,
              SUM(CASE WHEN vote = 'abstain' THEN 1 ELSE 0 END) as abstain_count
            FROM votes WHERE proposal_id = ?`,
      args: [proposalId],
    });

    const row = votes.rows[0];
    const yesCount = Number(row.yes_count) || 0;
    const noCount = Number(row.no_count) || 0;
    const abstainCount = Number(row.abstain_count) || 0;

    if (yesCount > noCount && proposal.rows.length > 0) {
      const p = proposal.rows[0];
      const token = import.meta.env.GITHUB_TOKEN;

      if (token) {
        const body = [
          p.description || '',
          '',
          '---',
          `Approved by consortium vote (${yesCount} yes / ${noCount} no / ${abstainCount} abstain)`,
          `Closed on: ${now}`,
        ].join('\n');

        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: p.title as string,
            body,
            labels: ['consortium-vote'],
          }),
        });

        if (res.ok) {
          const issue = await res.json();
          issueUrl = issue.html_url;
        }
      }
    }
  } catch {
    // GitHub issue creation is best-effort — don't fail the close operation
  }

  return new Response(JSON.stringify({ success: true, issueUrl }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
