/**
 * Site PI approvals for letters of collaboration.
 *
 * One `los_approvals` row exists per (request, site PI). PIs respond on the
 * tracker after signing in; the tracker summarises the rows as "N of M
 * approved". Each row also carries a random token (NOT NULL UNIQUE in the
 * schema), reserved for a future reply-by-email flow — it is never emailed.
 */

export type ApprovalDecision = 'approved' | 'declined';

export interface ApprovalRow {
  request_id: string;
  user_id: string | null;
  decision: ApprovalDecision | null;
  decided_at: string | null;
  full_name?: string | null;
  institution?: string | null;
}

export interface ApprovalTally {
  approved: number;
  declined: number;
  pending: number;
  total: number;
  /** "N/M approved" for badges. */
  label: string;
}

/** Summarise one request's approval rows. */
export function tallyApprovals(rows: ApprovalRow[]): ApprovalTally {
  let approved = 0;
  let declined = 0;
  for (const r of rows) {
    if (r.decision === 'approved') approved++;
    else if (r.decision === 'declined') declined++;
  }
  const total = rows.length;
  return {
    approved,
    declined,
    pending: total - approved - declined,
    total,
    label: `${approved}/${total} approved`,
  };
}

/** Group approval rows by request id, preserving row order within a request. */
export function groupApprovalsByRequest(rows: ApprovalRow[]): Map<string, ApprovalRow[]> {
  const map = new Map<string, ApprovalRow[]>();
  for (const r of rows) {
    const list = map.get(r.request_id) ?? [];
    list.push(r);
    map.set(r.request_id, list);
  }
  return map;
}

/** 32 random bytes as hex, filling the reserved token column. */
export function generateApprovalToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}


/** Parse the `action` query/body value into a decision, or null. */
export function parseDecision(v: unknown): ApprovalDecision | null {
  return v === 'approve' || v === 'approved'
    ? 'approved'
    : v === 'decline' || v === 'declined'
      ? 'declined'
      : null;
}
