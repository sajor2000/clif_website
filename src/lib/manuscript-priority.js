// Canonical manuscript priority levels, shared by the portal page renderer
// (src/pages/portal/status.astro), the admin edit form, and the write
// endpoints (src/pages/api/manuscripts/*) so the three never drift. Mirrors
// the shape of manuscript-status.js.
//
// Unlike `status`, a manuscript has at most ONE priority, stored as a single
// slug (or NULL when nobody has triaged it yet).

/** @typedef {{ label: string, classes: string }} PriorityTag */

/**
 * Ordered map of canonical slug -> display label + Tailwind chip classes.
 * Iteration order is highest-priority-first, and is the order levels render
 * in the form, the filter dropdown, and the sort.
 * NOTE: the class strings are scanned by Tailwind (this .js file is in the
 * content glob), so keep them as complete literal strings.
 * @type {Record<string, PriorityTag>}
 */
export const MANUSCRIPT_PRIORITY_TAGS = {
  critical: {
    label: 'Critical',
    // Solid rather than tinted: the other three levels are all pale washes, so
    // filling this one is what separates it from High at a glance.
    classes: 'bg-red-600 text-white dark:bg-red-700 dark:text-white',
  },
  high: {
    label: 'High',
    classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  medium: {
    label: 'Medium',
    classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  low: {
    label: 'Low',
    classes: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
  },
};

/** Slugs highest-first. Doubles as the sort order. */
export const PRIORITY_ORDER = Object.keys(MANUSCRIPT_PRIORITY_TAGS);

/** Chip classes for a manuscript with no priority set. */
export const PRIORITY_EMPTY_CLASSES =
  'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-400';

/** @param {string} slug */
export function isKnownPriority(slug) {
  return Object.prototype.hasOwnProperty.call(MANUSCRIPT_PRIORITY_TAGS, slug);
}

/**
 * Coerce a stored/imported value to a canonical slug, or null when unset.
 * Tolerant of casing and of the display label ("High", "HIGH") so values that
 * predate this column — or arrive from the CSV importer — still resolve.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function normalizePriority(raw) {
  const t = String(raw ?? '').trim().toLowerCase();
  if (!t) return null;
  return isKnownPriority(t) ? t : null;
}

/** @param {string} slug */
export function priorityLabel(slug) {
  return MANUSCRIPT_PRIORITY_TAGS[slug]?.label ?? slug;
}

/** @param {string} slug */
export function priorityClasses(slug) {
  return MANUSCRIPT_PRIORITY_TAGS[slug]?.classes ?? PRIORITY_EMPTY_CLASSES;
}

/**
 * Sort rank, ascending = most urgent first. Unset sorts last rather than
 * first, so one click on the column header surfaces the work that matters
 * instead of the rows nobody has triaged.
 * @param {string | null | undefined} slug
 */
export function priorityRank(slug) {
  const i = slug ? PRIORITY_ORDER.indexOf(slug) : -1;
  return i === -1 ? PRIORITY_ORDER.length : i;
}
