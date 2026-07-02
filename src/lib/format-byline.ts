// Pure formatting helpers for the manuscript byline builder
// (src/pages/portal/byline.astro). Also re-used by
// src/pages/portal/members/[id].astro for affiliation rendering.
//
// No DOM, no DB, no I/O — safe to import from server-side Astro frontmatter
// and from a client-side <script> that imports it.

export interface AuthorInput {
  id: string;
  full_name: string | null;
  degrees: string | null;
  affiliation: string | null;
  // Per-author flags chosen in the UI.
  equalContribution?: boolean;
  corresponding?: boolean;
  // Indices of parsed-affiliation items the user wants emitted (defaults to all).
  affiliationsIncluded?: number[];
  // Public-facing email when the user is the corresponding author.
  email?: string | null;
}

const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

export function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUPERSCRIPT_DIGITS[Number(d)] ?? d)
    .join('');
}

/**
 * Split a stored `affiliation` string into individual affiliation items.
 *
 * Handles three real-world patterns observed in the consortium data:
 *   - newline-delimited
 *   - "1. ... 2. ..." numbered prefixes (with or without "and"/";" between)
 *   - free-form single-line strings (returned as a one-item array)
 */
export function parseAffiliations(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const pieces = raw
    .split(/\r?\n+|\s*(?:and\s+|;\s*)?(?=\b\d+\.\s)/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return pieces.length > 0 ? pieces : [raw.trim()];
}

/**
 * Canonicalize an affiliation item so two near-identical strings (e.g. one
 * with a trailing period, the other without; one with leading "1.", the other
 * leading "and 2.") collapse to the same registry entry.
 */
export function normalizeAffiliation(s: string): string {
  return s
    .trim()
    .replace(/^(?:and\s+|;\s*)?\d+\.\s*/, '') // strip leading "1." / "and 2." / "; 3."
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .trim()
    .toLowerCase();
}

/**
 * Strip a leading "N. " prefix from an affiliation when emitting it in a
 * numbered registry block — the registry adds its own number.
 */
export function stripLeadingNumber(s: string): string {
  return s.replace(/^(?:and\s+|;\s*)?\d+\.\s*/, '').trim();
}

export interface ParsedName {
  first: string;
  middleInitials: string; // e.g. "A." or "A. B." or ""
  last: string;
}

/**
 * Best-effort split of a full name. Hyphenated trailing tokens (Park-Egan)
 * stay as one last name. Single-token names are treated as a last name only.
 */
export function parseName(full: string | null | undefined): ParsedName {
  const tokens = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { first: '', middleInitials: '', last: '' };
  if (tokens.length === 1) return { first: '', middleInitials: '', last: tokens[0] };
  const last = tokens[tokens.length - 1];
  const first = tokens[0];
  const middle = tokens.slice(1, -1);
  const middleInitials = middle
    .map((m) => {
      const cleaned = m.replace(/[^A-Za-z]/g, '');
      if (!cleaned) return '';
      // Already an initial like "A."? Keep as-is.
      if (cleaned.length === 1) return `${cleaned}.`;
      return `${cleaned[0]}.`;
    })
    .filter(Boolean)
    .join(' ');
  return { first, middleInitials, last };
}

/**
 * Vancouver / CSE "F" form: just the first letter of each component, no
 * periods, run together. "Catherine A. Gao" -> "CA".
 */
export function nameInitialsRunTogether(full: string | null | undefined): string {
  const tokens = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return '';
  return tokens
    .slice(0, -1)
    .map((t) => {
      const m = t.match(/[A-Za-z]/);
      return m ? m[0].toUpperCase() : '';
    })
    .join('');
}

export interface AffiliationRegistry {
  list: string[]; // emit order, 1-indexed by position in array
  byAuthor: Record<string, number[]>; // author.id -> [1, 4, 5]
}

export function buildAffiliationRegistry(authors: AuthorInput[]): AffiliationRegistry {
  const byNorm = new Map<string, number>(); // normalized -> 1-indexed
  const list: string[] = [];
  const byAuthor: Record<string, number[]> = {};

  for (const a of authors) {
    const items = parseAffiliations(a.affiliation);
    const include = a.affiliationsIncluded
      ? new Set(a.affiliationsIncluded)
      : null;
    const nums: number[] = [];
    items.forEach((item, idx) => {
      if (include && !include.has(idx)) return;
      const stripped = stripLeadingNumber(item);
      const key = normalizeAffiliation(stripped);
      if (!key) return;
      let num = byNorm.get(key);
      if (!num) {
        list.push(stripped);
        num = list.length;
        byNorm.set(key, num);
      }
      if (!nums.includes(num)) nums.push(num);
    });
    byAuthor[a.id] = nums;
  }

  return { list, byAuthor };
}

export interface FormatOptions {
  includeFootnotes?: boolean;
}

export interface FormattedByline {
  byline: string;
  footnotes: string;
  affBlock: string;
}

function superscriptList(nums: number[]): string {
  if (nums.length === 0) return '';
  return nums.map((n) => toSuperscript(n)).join(',');
}

function markerSuperscript(a: AuthorInput): string {
  // Equal-contribution and corresponding markers stay as plain `*` / `†`
  // so they remain visible when copy-pasted into Word.
  let m = '';
  if (a.equalContribution) m += '*';
  if (a.corresponding) m += '†';
  return m;
}

function affBlockText(registry: AffiliationRegistry): string {
  return registry.list
    .map((aff, i) => `${i + 1}. ${aff}`)
    .join('\n');
}

function equalContribFootnote(authors: AuthorInput[]): string | null {
  const equal = authors.filter((a) => a.equalContribution);
  if (equal.length === 0) return null;
  const honorifics = equal.map((a) => {
    const { last } = parseName(a.full_name);
    // Use "Dr." when degrees include MD/PhD/MBBS/DO/etc.; otherwise just last name.
    const deg = (a.degrees || '').toUpperCase();
    const isDr = /\b(MD|PHD|MBBS|DO|DDS|DVM|DR|MBCHB)\b/.test(deg);
    return `${isDr ? 'Dr. ' : ''}${last || a.full_name || '—'}`;
  });
  const list = listJoin(honorifics);
  return `*${list} contributed equally to this work.`;
}

function correspondingFootnote(authors: AuthorInput[]): string | null {
  const cor = authors.find((a) => a.corresponding);
  if (!cor) return null;
  const { first, middleInitials, last } = parseName(cor.full_name);
  const fullName = [first, middleInitials, last].filter(Boolean).join(' ');
  const email = (cor.email || '').trim();
  return email
    ? `†Corresponding author: ${fullName}, ${email}.`
    : `†Corresponding author: ${fullName}.`;
}

function listJoin(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * Vancouver / ICMJE byline.
 *   "Firstname I. Lastname¹, Firstname I. Lastname², and Firstname I. Lastname³"
 * No degrees in byline.
 */
export function formatVancouver(
  authors: AuthorInput[],
  registry: AffiliationRegistry,
  opts: FormatOptions = {}
): FormattedByline {
  const segments = authors.map((a) => {
    const { first, middleInitials, last } = parseName(a.full_name);
    const namePart = [first, middleInitials, last].filter(Boolean).join(' ');
    const sup = superscriptList(registry.byAuthor[a.id] || []);
    const marker = markerSuperscript(a);
    return `${namePart}${marker}${sup}`;
  });
  const byline = listJoin(segments);

  const footnoteLines: string[] = [];
  if (opts.includeFootnotes !== false) {
    const ec = equalContribFootnote(authors);
    if (ec) footnoteLines.push(ec);
    const cor = correspondingFootnote(authors);
    if (cor) footnoteLines.push(cor);
  }

  return {
    byline,
    footnotes: footnoteLines.join('\n'),
    affBlock: affBlockText(registry),
  };
}

/**
 * AMA / JAMA byline.
 *   "Firstname I. Lastname, MD¹; Firstname I. Lastname, PhD²; ..."
 * Semicolons separate authors; degrees inline before the superscript.
 */
export function formatAmaJama(
  authors: AuthorInput[],
  registry: AffiliationRegistry,
  opts: FormatOptions = {}
): FormattedByline {
  const segments = authors.map((a) => {
    const { first, middleInitials, last } = parseName(a.full_name);
    const namePart = [first, middleInitials, last].filter(Boolean).join(' ');
    const deg = (a.degrees || '').trim();
    const sup = superscriptList(registry.byAuthor[a.id] || []);
    const marker = markerSuperscript(a);
    const namedeg = deg ? `${namePart}, ${deg}` : namePart;
    return `${namedeg}${marker}${sup}`;
  });
  const byline = segments.join('; ');

  const footnoteLines: string[] = [];
  if (opts.includeFootnotes !== false) {
    const ec = equalContribFootnote(authors);
    if (ec) footnoteLines.push(ec);
    const cor = correspondingFootnote(authors);
    if (cor) footnoteLines.push(cor);
  }

  return {
    byline,
    footnotes: footnoteLines.join('\n'),
    affBlock: affBlockText(registry),
  };
}

/**
 * NLM / PubMed byline.
 *   "Lastname II¹, Lastname II², Lastname II³"
 * Surname first, then initials run together with no periods (the form PubMed
 * indexes and displays). Authors are comma-separated; no degrees in the byline.
 */
export function formatNlm(
  authors: AuthorInput[],
  registry: AffiliationRegistry,
  opts: FormatOptions = {}
): FormattedByline {
  const segments = authors.map((a) => {
    const { last } = parseName(a.full_name);
    const initials = nameInitialsRunTogether(a.full_name);
    const namePart = [last, initials].filter(Boolean).join(' ');
    const sup = superscriptList(registry.byAuthor[a.id] || []);
    const marker = markerSuperscript(a);
    return `${namePart}${marker}${sup}`;
  });
  const byline = segments.join(', ');

  const footnoteLines: string[] = [];
  if (opts.includeFootnotes !== false) {
    const ec = equalContribFootnote(authors);
    if (ec) footnoteLines.push(ec);
    const cor = correspondingFootnote(authors);
    if (cor) footnoteLines.push(cor);
  }

  return {
    byline,
    footnotes: footnoteLines.join('\n'),
    affBlock: affBlockText(registry),
  };
}

export type FormatId = 'vancouver' | 'ama' | 'nlm';

export function format(
  id: FormatId,
  authors: AuthorInput[],
  registry: AffiliationRegistry,
  opts: FormatOptions = {}
): FormattedByline {
  if (id === 'ama') return formatAmaJama(authors, registry, opts);
  if (id === 'nlm') return formatNlm(authors, registry, opts);
  return formatVancouver(authors, registry, opts);
}

/**
 * Concatenate a FormattedByline into the final plain-text block.
 */
export function renderFull(out: FormattedByline): string {
  return [out.byline, out.footnotes, out.affBlock].filter(Boolean).join('\n\n');
}
