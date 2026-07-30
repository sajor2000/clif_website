/**
 * Guards the inputs to the derived `ICU episodes per ICU hospitalization` row.
 *
 * The row is built in the frontmatter of
 * src/components/cohort_wip/InteractiveDashboard.astro (withRateRows) and so
 * cannot be imported. What is worth pinning is not the arithmetic but the two
 * facts about the export it rests on: that its denominator exists, and that the
 * two rows which could serve as that denominator agree.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCohortCSV, VISIBLE_COHORTS } from './cohortData';
import { cellCount } from './denominatorBasis';

const EPISODES = 'ICU episodes, total n';
const ICU_HOSPITALIZATIONS = 'Encounters with >=1 ICU episode, n (%)';
const ICU_ENCOUNTERS = 'ICU encounters, n (%)';

const parse = (c: string) =>
  parseCohortCSV(
    fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'cohorts', c, 'table_one_by_year.csv'), 'utf-8')
  );
const row = (p: ReturnType<typeof parse>, n: string) =>
  p.characteristics.find((c) => c.variable.trim() === n);

describe('ICU episode rate inputs', () => {
  it('has both rows wherever ICU episodes are reported', () => {
    for (const cohort of VISIBLE_COHORTS) {
      const p = parse(cohort.key);
      if (!row(p, EPISODES)) continue;
      expect(row(p, ICU_HOSPITALIZATIONS), `${cohort.key} has episodes but no denominator`).toBeTruthy();
    }
  });

  it('agrees with the other row that could serve as the denominator', () => {
    // 'ICU encounters' (an encounter TYPE) and 'Encounters with >=1 ICU
    // episode' are the same population under two names, which is why either
    // could be picked. If an export ever makes them diverge, the choice starts
    // to matter and someone should be told.
    for (const cohort of VISIBLE_COHORTS) {
      const p = parse(cohort.key);
      const a = row(p, ICU_HOSPITALIZATIONS);
      const b = row(p, ICU_ENCOUNTERS);
      if (!a || !b) continue;
      for (const site of p.allSites) {
        const x = cellCount(a.sites.get(site)?.get('Overall'));
        const y = cellCount(b.sites.get(site)?.get('Overall'));
        if (x == null || y == null) continue;
        expect(x, `${cohort.key}/${site}: ${ICU_HOSPITALIZATIONS}=${x} vs ${ICU_ENCOUNTERS}=${y}`).toBe(y);
      }
    }
  });

  it('yields a mean of at least one episode per ICU hospitalization', () => {
    // Below 1.0 would mean more ICU hospitalizations than ICU episodes, which
    // cannot happen — it would say the two rows count different populations.
    for (const cohort of VISIBLE_COHORTS) {
      const p = parse(cohort.key);
      const ep = row(p, EPISODES);
      const den = row(p, ICU_HOSPITALIZATIONS);
      if (!ep || !den) continue;
      for (const site of [...p.allSites, 'ALL']) {
        const e = cellCount(ep.sites.get(site)?.get('Overall'));
        const n = cellCount(den.sites.get(site)?.get('Overall'));
        if (e == null || n == null || n === 0) continue;
        expect(e / n, `${cohort.key}/${site}: ${e} episodes over ${n} hospitalizations`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
