/**
 * Content of a generated consortium letter of collaboration.
 *
 * The letter follows the consortium's fixed template: letterhead, date, a
 * "Re:" line, the salutation, one boilerplate paragraph with the applicant's
 * institution, PI, grant title and funding agency filled in, an optional
 * project-specific paragraph, "Sincerely," and a signature block of every
 * site PI who approved the request on the tracker. This module is pure: the
 * .docx and .pdf renderers both consume the `LetterContent` it builds, and
 * the tracker shows the same paragraph text so PIs approve exactly what the
 * letter will say.
 */

export const LETTERHEAD_TITLE = 'Common Longitudinal ICU data Format (CLIF) Consortium';
export const LETTER_SALUTATION = 'Dear Review Committee Members:';
export const LETTER_CLOSING = 'Sincerely,';
export const DEFAULT_FUNDING_AGENCY = 'NIH';

/** The los_requests columns the letter text is built from. */
export interface LetterRequestFields {
  grant_title: string;
  grant_type?: string | null;
  applicant_pi?: string | null;
  applicant_institution?: string | null;
  funding_agency?: string | null;
  extra_paragraph?: string | null;
}

export interface SignatureImage {
  mime: 'image/png' | 'image/jpeg';
  data: Uint8Array;
  width: number;
  height: number;
}

export interface Signatory {
  user_id: string;
  full_name: string | null;
  degrees?: string | null;
  institution?: string | null;
  /** null when the PI has not uploaded a signature; the name line still prints. */
  signature: SignatureImage | null;
}

export interface LetterContent {
  letterheadTitle: string;
  date: string;
  re: string;
  salutation: string;
  paragraphs: string[];
  closing: string;
  /** Sorted by last name. */
  signatories: Signatory[];
}

/** The fixed template paragraph with the request's blanks filled in. */
export function letterParagraph(r: LetterRequestFields): string {
  const institution = (r.applicant_institution || '').trim() || '[institution]';
  const pi = (r.applicant_pi || '').trim() || '[PI]';
  const agency = (r.funding_agency || '').trim() || DEFAULT_FUNDING_AGENCY;
  const title = r.grant_title.trim();
  return (
    `We are the steering committee leadership of the CLIF consortium. If the application submitted by ` +
    `${institution} with ${pi}, as the Principal Investigator, entitled “${title},” is selected for ` +
    `funding by ${agency}, it is our intent to collaborate, provide data, and perform analyses as detailed in ` +
    `the application.`
  );
}

/** Template paragraph followed by the optional project-specific paragraph(s). */
export function letterParagraphs(r: LetterRequestFields): string[] {
  const out = [letterParagraph(r)];
  const extra = (r.extra_paragraph || '').trim();
  if (extra) {
    for (const p of extra.split(/\n\s*\n/)) {
      const t = p.replace(/\s*\n\s*/g, ' ').trim();
      if (t) out.push(t);
    }
  }
  return out;
}

export function letterSubject(r: LetterRequestFields): string {
  const type = (r.grant_type || '').trim();
  return `Re: ${type ? `${type} – ` : ''}${r.grant_title.trim()}`;
}

/** "November 4, 2026" */
export function formatLetterDate(d: Date, timeZone = 'America/Chicago'): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone });
}

/** "Siva Bhavani, MD, MS – Emory University" */
export function signatoryLine(s: Pick<Signatory, 'full_name' | 'degrees' | 'institution'>): string {
  const name = (s.full_name || '').trim() || 'Site PI';
  const degrees = (s.degrees || '').trim();
  const institution = (s.institution || '').trim();
  return `${name}${degrees ? `, ${degrees}` : ''}${institution ? ` – ${institution}` : ''}`;
}

const NAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'md', 'phd']);

/** Last word of the name, skipping generational suffixes and stray degree tokens. */
export function lastName(fullName: string | null | undefined): string {
  const parts = (fullName || '')
    .replace(/,.*$/, '') // "Parker, William" / "Name, MD" → keep what precedes the comma
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (parts.length > 1 && NAME_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  return (parts[parts.length - 1] || '').toLowerCase();
}

/** Alphabetical by last name, then by full name, so the block is stable. */
export function sortSignatories<T extends { full_name: string | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const byLast = lastName(a.full_name).localeCompare(lastName(b.full_name));
    if (byLast !== 0) return byLast;
    return (a.full_name || '').localeCompare(b.full_name || '');
  });
}

export function buildLetterContent(
  r: LetterRequestFields,
  signatories: Signatory[],
  now: Date = new Date(),
): LetterContent {
  return {
    letterheadTitle: LETTERHEAD_TITLE,
    date: formatLetterDate(now),
    re: letterSubject(r),
    salutation: LETTER_SALUTATION,
    paragraphs: letterParagraphs(r),
    closing: LETTER_CLOSING,
    signatories: sortSignatories(signatories),
  };
}

/** "CLIF_LOC_Early_mobilization_2026-11-04.docx" */
export function letterFileName(r: LetterRequestFields, ext: 'docx' | 'pdf', now: Date = new Date()): string {
  const words = r.grant_title
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  // Up to six whole words, never cut mid-word, within a sane length.
  let slug = '';
  for (const w of words.slice(0, 6)) {
    if (slug && slug.length + 1 + w.length > 64) break;
    slug = slug ? `${slug}_${w}` : w;
  }
  const day = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); // YYYY-MM-DD
  return `CLIF_LOC_${slug || 'letter'}_${day}.${ext}`;
}

/**
 * Fit an image into a box, preserving aspect ratio and never enlarging past
 * the box. Returns the drawn size in the box's units (points).
 */
export function fitImage(
  img: { width: number; height: number },
  box: { width: number; height: number },
): { width: number; height: number } {
  const scale = Math.min(box.width / img.width, box.height / img.height);
  return { width: Math.round(img.width * scale * 100) / 100, height: Math.round(img.height * scale * 100) / 100 };
}

/** Box each signature image is fitted into, in points. */
export const SIGNATURE_BOX = { width: 190, height: 60 };
