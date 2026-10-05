// Shared vocabulary for the mCIDE Surveyor: the shape of a field's
// mapping doc as the build script writes it and the portal reads it, plus the
// pure helpers both sides need. Erasable TypeScript only — Node runs this file
// through type stripping from scripts/build-mcide-mappings.mjs.

/** How a site's category value relates to the official mCIDE. */
export type MappingStatus = 'valid' | 'case_variant' | 'off_schema' | 'unmapped';

/** One raw name → category pair, with the records each site maps through it. */
export interface MappingRow {
  /** Raw source name, exactly as the site exported it. */
  n: string;
  /** Category the site assigned. */
  c: string;
  s: MappingStatus;
  /** Records per site code, e.g. `{ JHU: 1200 }`. Absent sites map nothing here. */
  k: Record<string, number>;
  /** Extra exported columns (lab_loinc_code, location_type, assessment_group). */
  x?: Record<string, string>;
}

/** Names the long-tail cap dropped, so the UI can say how much is missing. */
export interface TailSummary {
  names: number;
  records: number;
}

export interface MappingDoc {
  table: string;
  field: string;
  nameCol: string;
  catCol: string;
  sites: string[];
  rows: MappingRow[];
  tail: Record<string, TailSummary>;
  run: { label: string; mcide_version: string };
}

export interface SiteScore {
  names: number;
  records: number;
  categories: number;
  /** Share of records by status, 0–1. */
  share: Record<MappingStatus, number>;
  /** Names this site maps differently from at least one other site. */
  conflicts: number;
}

export interface VagueBucket {
  category: string;
  names: number;
  records: number;
  /** Records per site. */
  k: Record<string, number>;
}

export interface FieldSummary {
  table: string;
  field: string;
  nameCol: string;
  sites: string[];
  names: number;
  records: number;
  categories: number;
  conflicts: number;
  share: Record<MappingStatus, number>;
  perSite: Record<string, SiteScore>;
  vague: VagueBucket[];
  /** Rows dropped by the cap, if any. */
  tail: Record<string, TailSummary>;
}

/**
 * Comparison key for a raw name: case, surrounding/duplicate whitespace and
 * punctuation are the differences between sites' exports of the same thing,
 * never the display form. `PROPOFOL  10 MG/ML` and `propofol 10 mg/ml` compare
 * equal; the row keeps the raw string.
 */
export function norm(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Values that mean "this site mapped nothing here". Mirrors NULLISH in
 * build-mcide-coverage.mjs; `unknown` and `na` are real mCIDE values and so
 * deliberately absent.
 */
export const UNMAPPED = new Set(['', 'nan', 'n/a', 'null', 'none', 'no_mapping']);

export function isUnmapped(value: string): boolean {
  return UNMAPPED.has(String(value ?? '').trim().toLowerCase());
}

/**
 * Catch-all categories a project lead may need to look inside before deciding
 * whether to include them. Exact tokens plus anything containing `other`
 * (`other_antibiotic`, `other_vasopressor`...).
 */
const VAGUE_TOKENS = new Set(['other', 'others', 'unknown', 'misc', 'miscellaneous', 'unspecified', 'na']);

export function isVague(category: string): boolean {
  const c = String(category ?? '').trim().toLowerCase();
  return isUnmapped(c) || VAGUE_TOKENS.has(c) || /(^|_)other(s?)(_|$)/.test(c);
}

/**
 * Classify a category value against the official values of its field.
 *
 * `official` maps each of the field's mCIDE values, lower-cased, to its
 * canonical spelling (some 2.1 fields are Title Case, e.g. `Nasal Cannula`).
 * A value that equals the canonical spelling is `valid`; one that matches only
 * after lower-casing, or after treating spaces, hyphens and underscores as
 * the same, is a `case_variant`: the site means the right concept but a
 * case-sensitive join will miss it.
 */
export function statusFor(value: string, official: Map<string, string> | undefined): MappingStatus {
  const raw = String(value ?? '').trim();
  if (isUnmapped(raw)) return 'unmapped';
  if (!official) return 'off_schema';
  const lower = raw.toLowerCase();
  const canonical = official.get(lower) ?? official.get(lower.replace(/[\s-]+/g, '_'));
  if (canonical === undefined) return 'off_schema';
  return canonical === raw ? 'valid' : 'case_variant';
}

/** Sum of a row's per-site counts. */
export function rowTotal(row: MappingRow): number {
  let t = 0;
  for (const v of Object.values(row.k)) t += v;
  return t;
}
