import { describe, it, expect } from 'vitest';
import { CURRENT_ATS, STATUS_BADGE, parseConference, toProjectRunStatus } from './project-run-status';
import { parseProjectRunFields } from '../pages/api/project-runs/create';
import { runnableTables } from '../data/clif-tables';

describe('toProjectRunStatus', () => {
  it('keeps known statuses and defaults the rest to open', () => {
    expect(toProjectRunStatus('upcoming')).toBe('upcoming');
    expect(toProjectRunStatus('closed')).toBe('closed');
    expect(toProjectRunStatus('open')).toBe('open');
    expect(toProjectRunStatus(null)).toBe('open');
    expect(toProjectRunStatus('bogus')).toBe('open');
  });

  it('labels open runs as Active', () => {
    expect(STATUS_BADGE.open.label).toBe('Active');
  });
});

describe('parseConference', () => {
  it('accepts the current ATS tag only', () => {
    expect(parseConference(CURRENT_ATS)).toBe(CURRENT_ATS);
    expect(parseConference(` ${CURRENT_ATS} `)).toBe(CURRENT_ATS);
    expect(parseConference('')).toBeNull();
    expect(parseConference('Made up conf')).toBeNull();
    expect(parseConference(undefined)).toBeNull();
  });

  it("keeps a run's existing tag from an earlier year", () => {
    expect(parseConference('ATS 2025', 'ATS 2025')).toBe('ATS 2025');
    expect(parseConference('ATS 2025', 'ATS 2024')).toBeNull();
  });
});

describe('parseProjectRunFields', () => {
  const complete = {
    title: 'Sepsis phenotypes',
    repo_url: 'https://github.com/x/y',
    box_folder_url: 'https://box.com/f',
    description: 'Short summary',
    instructions: 'Run it',
    purpose: 'conference',
    purpose_detail: CURRENT_ATS,
    results_deadline: '2099-01-01',
    clif_version: '2.1',
    required_tables: [runnableTables('2.1')[0]],
    prelim_shared: true,
    prelim_link: 'https://example.org/prelim',
  };
  const notReadyYet = { ...complete, repo_url: '', box_folder_url: '', prelim_shared: false, prelim_link: '' };

  it('accepts a complete run in both modes', () => {
    expect('fields' in parseProjectRunFields(complete, 'full')).toBe(true);
    expect('fields' in parseProjectRunFields(complete, 'upcoming')).toBe(true);
  });

  it('requires repo, Box and prelim results in full mode (the default)', () => {
    expect(parseProjectRunFields({ ...complete, repo_url: '' })).toEqual({ error: 'Project repo is required.' });
    expect(parseProjectRunFields({ ...complete, box_folder_url: '' })).toEqual({ error: 'Box folder is required.' });
    expect('error' in parseProjectRunFields({ ...complete, prelim_shared: false })).toBe(true);
    expect(parseProjectRunFields({ ...complete, prelim_link: '' })).toEqual({
      error: 'A link to the preliminary results is required.',
    });
  });

  it('lets an upcoming run skip repo, Box and prelim results, stored as empty', () => {
    const parsed = parseProjectRunFields(notReadyYet, 'upcoming');
    expect(parsed).toMatchObject({
      fields: { repo_url: null, box_folder_url: null, prelim_shared: 0, prelim_link: null },
    });
  });

  it('drops a prelim link when the results are not marked shared', () => {
    const parsed = parseProjectRunFields({ ...notReadyYet, prelim_link: 'https://stray' }, 'upcoming');
    expect(parsed).toMatchObject({ fields: { prelim_link: null } });
  });

  it('still requires the other fields for an upcoming run', () => {
    expect(parseProjectRunFields({ ...notReadyYet, title: '' }, 'upcoming')).toEqual({
      error: 'Project title is required.',
    });
    expect(parseProjectRunFields({ ...notReadyYet, instructions: '' }, 'upcoming')).toEqual({
      error: 'Specific instructions are required.',
    });
    expect('error' in parseProjectRunFields({ ...notReadyYet, required_tables: [] }, 'upcoming')).toBe(true);
    expect('error' in parseProjectRunFields({ ...notReadyYet, results_deadline: '' }, 'upcoming')).toBe(true);
  });
});
