import { describe, expect, it } from 'vitest';
import {
  generateApprovalToken,
  groupApprovalsByRequest,
  parseDecision,
  tallyApprovals,
} from './los-approvals';

const row = (request_id: string, decision: 'approved' | 'declined' | null, user_id = 'u') => ({
  request_id,
  user_id,
  decision,
  decided_at: decision ? '2026-10-30T00:00:00Z' : null,
});

describe('tallyApprovals', () => {
  it('counts approved, declined and pending', () => {
    const t = tallyApprovals([row('r', 'approved'), row('r', null), row('r', 'declined'), row('r', 'approved')]);
    expect(t).toEqual({ approved: 2, declined: 1, pending: 1, total: 4, label: '2/4 approved' });
  });

  it('handles a request with no site PIs', () => {
    expect(tallyApprovals([])).toEqual({ approved: 0, declined: 0, pending: 0, total: 0, label: '0/0 approved' });
  });
});

describe('groupApprovalsByRequest', () => {
  it('buckets rows by request id in order', () => {
    const g = groupApprovalsByRequest([row('a', null, 'u1'), row('b', 'approved', 'u1'), row('a', 'approved', 'u2')]);
    expect([...g.keys()]).toEqual(['a', 'b']);
    expect(g.get('a')!.map((r) => r.user_id)).toEqual(['u1', 'u2']);
  });
});

describe('tokens', () => {
  it('generates 64 lowercase hex chars, unique per call', () => {
    const t = generateApprovalToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(generateApprovalToken()).not.toBe(t);
  });
});

describe('parseDecision', () => {
  it('accepts both verb and past-tense spellings', () => {
    expect(parseDecision('approve')).toBe('approved');
    expect(parseDecision('approved')).toBe('approved');
    expect(parseDecision('decline')).toBe('declined');
    expect(parseDecision('reset')).toBeNull();
  });
});
