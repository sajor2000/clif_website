// Canonical manuscript status tags, shared by the CSV import script
// (scripts/import-manuscripts-csv.mjs), the portal page renderer
// (src/pages/portal/status.astro), and the admin edit form so the three never
// drift. A manuscript's `status` is stored in the DB as a comma-separated list
// of the slugs defined here.

/** @typedef {{ label: string, classes: string }} StatusTag */

/**
 * Ordered map of canonical slug -> display label + Tailwind chip classes.
 * Iteration order is the order tags render in the form and on the page.
 * NOTE: the class strings are scanned by Tailwind (this .js file is in the
 * content glob), so keep them as complete literal strings.
 * @type {Record<string, StatusTag>}
 */
export const MANUSCRIPT_STATUS_TAGS = {
  published: {
    label: 'Published',
    classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  accepted: {
    label: 'Accepted',
    classes: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  },
  'under-review': {
    label: 'Under review',
    classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  'pre-print': {
    label: 'Pre-print',
    classes: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  'manuscript-wip': {
    label: 'Manuscript WIP',
    classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  'code-released': {
    label: 'Code released',
    classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  'buddy-testing': {
    label: 'Buddy testing',
    classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  'code-run-complete': {
    label: 'Code run complete',
    classes: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  },
  'code-under-development': {
    label: 'Code under development',
    classes: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-400',
  },
  'research-design': {
    label: 'Research Design',
    classes: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  },
  'not-started': {
    label: 'Not started',
    classes: 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300',
  },
};

const FALLBACK_CLASSES =
  'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-400';

/**
 * The manuscript lifecycle as an ordered pipeline, earliest → most advanced.
 * Drives the "progress map" legend on the tracker and selects the single
 * furthest-along status shown on each manuscript row.
 * @type {string[]}
 */
export const STATUS_PROGRESSION = [
  'not-started',
  'research-design',
  'code-under-development',
  'code-run-complete',
  'buddy-testing',
  'code-released',
  'manuscript-wip',
  'pre-print',
  'under-review',
  'accepted',
  'published',
];

/**
 * Pick the most-advanced status from a list of slugs, per STATUS_PROGRESSION.
 * Falls back to the first slug if none are in the known progression, or null
 * when the list is empty.
 * @param {string[]} slugs
 * @returns {string | null}
 */
export function latestStatus(slugs) {
  if (!slugs || slugs.length === 0) return null;
  let best = null;
  let bestIdx = -1;
  for (const s of slugs) {
    const idx = STATUS_PROGRESSION.indexOf(s);
    if (idx > bestIdx) {
      bestIdx = idx;
      best = s;
    }
  }
  return best || slugs[0];
}

// Normalized free-text phrase -> canonical slug. Covers the spelling variants
// seen in the source "Internal Tracker - Manuscripts" sheet.
const PHRASE_TO_SLUG = {
  'published': 'published',
  'accepted': 'accepted',
  'under review': 'under-review',
  'in review': 'under-review',
  'pre print': 'pre-print',
  'preprint': 'pre-print',
  'manuscript wip': 'manuscript-wip',
  'manuscript in progress': 'manuscript-wip',
  'buddy testing': 'buddy-testing',
  'code run complete': 'code-run-complete',
  'code under development': 'code-under-development',
  'code released': 'code-released',
  'research design': 'research-design',
  'not started': 'not-started',
};

/** Lowercase, collapse whitespace/underscores/dashes to single spaces, trim. */
function normalizePhrase(phrase) {
  return String(phrase).toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

/**
 * Parse a raw status cell (comma-separated free text, or already-stored slugs)
 * into an ordered, de-duped list of canonical slugs. Unknown phrases are kept
 * (slugified) rather than dropped; the renderer falls back to a neutral chip.
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
export function normalizeStatus(raw) {
  if (!raw) return [];
  const seen = new Set();
  const out = [];
  for (const part of String(raw).split(',')) {
    const norm = normalizePhrase(part);
    if (!norm) continue;
    const slug = PHRASE_TO_SLUG[norm] || norm.replace(/\s+/g, '-');
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

/** Display label for a slug (humanizes unknown slugs). */
export function statusLabel(slug) {
  return (
    MANUSCRIPT_STATUS_TAGS[slug]?.label ||
    slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Tailwind chip classes for a slug (neutral fallback for unknown slugs). */
export function statusClasses(slug) {
  return MANUSCRIPT_STATUS_TAGS[slug]?.classes || FALLBACK_CLASSES;
}

/** Whether a slug is one of the known canonical tags (for API validation). */
export function isKnownStatus(slug) {
  return Object.prototype.hasOwnProperty.call(MANUSCRIPT_STATUS_TAGS, slug);
}
