/**
 * Guards the one assumption every recomputed percentage on the cohort
 * dashboard rests on: that the row it divides by can actually be found.
 *
 * The Charts view does not reuse the export's `(%)` text — it sums counts per
 * site/year and divides by a denominator row it looks up by name. It asks for
 * that row under the name a reader knows it by, 'N: Hospitalizations', while
 * the export ships it as 'N: Encounter blocks'. When the lookup missed, the
 * denominator came out empty and the chart claimed "No data available" for a
 * characteristic whose numbers were present all along — silent, and wrong in
 * the direction that looks like missing data rather than a bug.
 *
 * So this asserts the resolver, not the renderer: the display name lands on a
 * real row in every cohort, and the percentage it yields matches the one the
 * export computed upstream.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCohortCSV, VISIBLE_COHORTS } from './cohortData';

/**
 * Mirrors DISPLAY_RENAMES and dataKey() in
 * src/components/cohort/InteractiveDashboard.astro — the client script
 * lives inside a .astro file and cannot be imported, so the resolver is
 * restated here. Keep the two in step.
 */
const DISPLAY_RENAMES: Record<string, string> = {
  'N: Encounter blocks': 'N: Hospitalizations',
  'Admission type: na': 'Admission type: Missing',
  'Intubated ≤24hr of admission, n (%)': 'Intubated ≤24hr of admission, n (% of IMV)',
  'Reintubation (≥2 IMV episodes), n (%)': 'Reintubation (≥2 IMV episodes), n (% of IMV)',
};
const CSV_NAMES = Object.fromEntries(
  Object.entries(DISPLAY_RENAMES).map(([csvName, shown]) => [shown, csvName])
);

function makeDataKey(characteristics: { variable: string }[]) {
  const has = (k: string) => characteristics.some((c) => c.variable.trim() === k);
  return (name: string) => {
    const trimmed = (name || '').trim();
    if (has(trimmed)) return trimmed;
    const csvName = CSV_NAMES[trimmed];
    return csvName && has(csvName) ? csvName : trimmed;
  };
}

/** Leading count of a `12,345 (6.7%)` cell; null for '<10', '' or a median. */
const count = (v: string | undefined) => {
  const m = (v ?? '').match(/^\s*([\d,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
};
const statedPct = (v: string | undefined) => {
  const m = (v ?? '').match(/\(([\d.]+)%\)/);
  return m ? parseFloat(m[1]) : null;
};

function parse(cohortKey: string) {
  const csv = fs.readFileSync(
    path.join(process.cwd(), 'src', 'data', 'cohorts', cohortKey, 'table_one_by_year.csv'),
    'utf-8'
  );
  return parseCohortCSV(csv);
}

/**
 * The row this was found on. Divided by the encounter denominator in every
 * cohort that has it — the 'Overall' (all-hospitalized) cohort ships hospital
 * mortality without the expired/hospice split, so it has none to check.
 */
const PROBE_ROW = 'Expired, n (%)';
const cohortsWithProbe = VISIBLE_COHORTS.filter((c) =>
  parse(c.key).characteristics.some((ch) => ch.variable.trim() === PROBE_ROW)
);

describe('cohort chart denominators', () => {
  for (const cohort of VISIBLE_COHORTS) {
    it(`${cohort.key}: 'N: Hospitalizations' resolves to a row that exists`, () => {
      const parsed = parse(cohort.key);
      const dataKey = makeDataKey(parsed.characteristics);

      const key = dataKey('N: Hospitalizations');
      const denomRow = parsed.characteristics.find((c) => c.variable.trim() === key);
      expect(denomRow, `${cohort.key}: no row named '${key}'`).toBeTruthy();

      // Demographics' denominator needs no translation — it must not acquire one.
      expect(dataKey('N: Unique patients')).toBe('N: Unique patients');
    });
  }

  for (const cohort of cohortsWithProbe) {
    it(`${cohort.key}: recomputed '${PROBE_ROW}' matches the export, per site`, () => {
      const parsed = parse(cohort.key);
      const dataKey = makeDataKey(parsed.characteristics);
      const denomRow = parsed.characteristics.find(
        (c) => c.variable.trim() === dataKey('N: Hospitalizations')
      )!;
      const probe = parsed.characteristics.find((c) => c.variable.trim() === PROBE_ROW)!;

      let compared = 0;
      for (const site of parsed.allSites) {
        const cell = probe.sites.get(site)?.get('Overall');
        const n = count(cell);
        const stated = statedPct(cell);
        const denom = count(denomRow.sites.get(site)?.get('Overall'));
        if (n == null || stated == null || !denom) continue;

        const recomputed = (n / denom) * 100;
        expect(
          Math.abs(recomputed - stated),
          `${cohort.key}/${site}: export says ${cell}, denominator ${denom} gives ${recomputed.toFixed(1)}%`
        ).toBeLessThan(0.15);
        compared++;
      }

      // An empty loop must not read as a pass.
      expect(compared, `${cohort.key}: no site had both a count and a denominator`).toBeGreaterThan(5);
    });
  }

  it('the probe row exists in the critically-ill cohorts', () => {
    expect(cohortsWithProbe.map((c) => c.key)).toContain('overall');
    expect(cohortsWithProbe.length).toBeGreaterThan(3);
  });
});
