# Cohort data processing pipeline

How raw aggregation exports become the data the cohort dashboard ships. Read
this before refreshing the data — the rules here exist so a refresh never
pushes raw data or silently resurrects removed slices.

## Directory layout and git rules

| Path | Tracked? | Role |
|---|---|---|
| `src/data/_aggregated_new/` | **ignored** | Raw export as delivered (drop new exports here) |
| `src/data/_aggregated/` | **ignored** | Preprocessed export — the only input the refresh scripts read |
| `src/data/_aggregated_old/` | **ignored** | Previous export, kept for diffing |
| `src/data/cohorts/` | tracked | Derived table_one + ancillary CSVs → `/cohort_wip` |
| `src/data/cohort_wip_ecdf/` | tracked | Derived ECDF CSVs → `/cohort_wip` Distributions tab |
| `src/data/cohort_dash_1/` | tracked | Frozen older dataset → public `/cohort` page (NOT refreshed by this pipeline) |

`.gitignore` covers `src/data/_aggregated*/` — **raw exports must never be
committed**; only derived, preprocessed CSVs enter the repo. `git status`
should never show anything under an `_aggregated` name.

## Refresh procedure

1. **Drop the new export** at `src/data/_aggregated_new/` (rename the previous
   `_aggregated` to `_aggregated_old` if you want a diffing baseline).
2. **Preprocess** `_aggregated_new` → `_aggregated`:
   ```bash
   node scripts/preprocess-aggregated.mjs --dry-run   # inspect first
   node scripts/preprocess-aggregated.mjs
   ```
   Everything not named by a preprocessing step is copied through unchanged
   (minus `.DS_Store`).
3. **Derive the tracked data** from the processed export:
   ```bash
   node scripts/refresh-cohort-tableone.mjs --dry-run   # inspect first
   node scripts/refresh-cohort-tableone.mjs             # writes src/data/cohorts/
   python3 scripts/refresh-cohort-ecdf.py --dry-run
   python3 scripts/refresh-cohort-ecdf.py               # writes src/data/cohort_wip_ecdf/
   ```
   Both scripts fail loudly on missing sources/sites — that is the point;
   do not paper over a MISSING SOURCE error.
4. **Verify**: diff the derived dirs (site columns all present, row counts
   plausible), `npm run build`, spot-check `/cohort_wip`.
5. **Commit** only the derived dirs (+ any script changes). Never `git add`
   an `_aggregated*` path.

## Preprocessing steps

Applied in order. Each step says what it changes, why, and where it is
implemented.

### Step 1 — Sub-cohort splits removed (Aug 2026)

The dashboard's third-level ICU / Non-ICU picker was removed (`SUBCOHORTS` is
empty in `src/utils/cohortData.ts`), so the six sub-cohort slices are neither
shown nor shipped:

- `cohorts/advanced_resp__icu`, `cohorts/advanced_resp__no_icu`
- `cohorts/vaso__icu`, `cohorts/vaso__no_icu`
- `cohorts/vaso__ed_icu`, `cohorts/vaso__ed_ward`

Implementation: the directories were deleted from `src/data/cohorts/` and the
`SUBS` map, `splitGroup()` transform, and sub-cohort jobs were removed from
`scripts/refresh-cohort-tableone.mjs`, so a refresh cannot recreate them. The
export's `table_one_*_vs_*.csv` comparison files and `*_icu.csv`-suffixed
ancillary files are simply never read.

Restoring the level = re-adding the SUBS jobs to the refresh script AND the
`SUBCOHORTS` entries in `cohortData.ts` (see comments at both sites).

### Step 2 — Table-one subcategory subsuming (Aug 2026)

Implemented by `scripts/preprocess-aggregated.mjs` (`--dry-run` supported),
which copies `_aggregated_new` → `_aggregated` and rewrites all 15
`table_one*.csv` files (overall, by-year, and per-cohort incl. `_vs_`
variants). Its `STEPS` list mirrors the rules below — add new fold rules
there and document them here. Every folded `other` row also carries an
exact-match tooltip in `src/utils/characteristicDefinitions.ts` saying what
it covers — when adding a fold rule, add its definition there too.

**Cell algebra when folding rows** (decided 2026-08-13):
- `"65,491 (64.9%)"` → counts sum. The folded percentage is recomputed as
  count / denominator, where the denominator is back-solved from the group's
  largest percentage-bearing row in the same column (`n*100/p`). Summing the
  components' already-rounded percentages is NOT acceptable: three 0.0% rows
  can hide a true 0.1%, and `src/utils/denominatorBasis.ts` verifies every
  stated percentage against the export's own arithmetic to ±0.06pp (its test
  suite runs that check over the real shipped CSVs).
- `<10` (suppressed) → contributes **0** — folded values are a lower bound;
  no midpoint imputation.
- blank → contributes nothing; the folded cell is blank only if every
  component cell was blank.
- The export appends late-discovered group rows (e.g. `Missing`, `hospice`,
  `psych` in `_vs_` files) at the bottom of the sheet; the fold collects
  group rows wherever they appear and rebuilds the group at its block.

**Rule 2a — First admission location**: keep `ed`, `ward`, `icu`,
`procedural`; fold every other label (`stepdown`, `other`, `rehab`,
`radiology`, `l&d`, `hospice`, `psych`, `dialysis`, `Missing`, ...) into
`First admission location: other`.

**Rule 2b — Admission type**: keep `ed`, `osh`, `facility`, `direct`; fold
every other label (`elective`, `other`, `na`, ...) into
`Admission type: other`.

**Rule 2c — First location at IMV start**: keep `icu`, `ed`, `ward`,
`procedural`; fold every other label (`stepdown`, `other`, `radiology`,
`l&d`, `dialysis`, `hospice`, `rehab`, `Missing`, ...) into
`First location at IMV start: other`.

**Rule 2d — Initial ventilator mode**: keep `assist control-volume control`,
`pressure-regulated volume control`, `pressure control`,
`pressure support/cpap`, `simv`; fold every other label (`Missing`,
`standby`, `other`, `aprv`, `blow by`, `volume support`, and the blank-label
`Initial ventilator mode: ` row) into `Initial ventilator mode: other`.

**Rule 2e — Extubation outcome** (fold-list: only the named labels fold, so
an unexpected new label stays visible): fold `unknown` and `failed_attempt`
into `Extubation outcome: other`; `extubated`, `death_on_imv`,
`discharged_on_imv` stay.

**Rule 2f — rename to Terminal IMV outcome** (after 2e): the group becomes
`Terminal IMV outcome:` with labels `extubated` → `discharged not on IMV`,
`death_on_imv` → `dead`, `discharged_on_imv` → `discharge on IMV`; `other`
keeps its name. Values untouched — rename only. The matching tooltip key in
`src/utils/characteristicDefinitions.ts` (`PREFIX_DEFINITIONS`) was renamed
with it; `denominatorBasis.ts` needs nothing (label-agnostic back-solver).

**Rule 2g — Race/Ethnicity/Sex crosstab**
(`demographic_crosstab_race_ethnicity_sex.csv`, one per cohort; plain patient
counts, no percentages): drop the sex `Unknown` sub-columns AND the ethnicity
`Unknown` column group (only Non-Hispanic/Hispanic × Female/Male remain);
fold the race rows `American Indian or Alaska Native`, `Native Hawaiian or
Other Pacific Islander`, `Other`, `Unknown` into one `Other` row (fold-list —
an unexpected new race label stays visible); recompute the Total column and
Total row from the surviving cells. The dashboard's crosstab
(`DemographicCrosstab.astro`) carries a tooltip on the `Other` row naming the
folded categories.

**Rule 2h — Sex: Other and Ethnicity: Other dropped**: both rows are removed
from all table_ones. Dropped rather than folded — there is no sibling
category to absorb them. `Sex: Other` is 190 patients consortium-wide (0.0%);
`Ethnicity: Other` is ~11% of encounters and was dropped by product decision
(2026-08-13), leaving Non-Hispanic / Hispanic as the ethnicity rows.

**Rule 2i — Race tail folded into Other (table_ones)**: mirrors rule 2g in
the table_ones — `Race: american indian or alaska native`,
`Race: native hawaiian or other pacific islander`, and `Race: unknown` merge
into the export's own `Race: Other` row (the fold list includes `Other`
itself so the counts sum into one row). Kept: White, Black or African
American, Asian, Other.

## Refresh history

- **2026-08**: new export received as `_aggregated_new`; same file shapes and
  site roster (11 sites + ALL) as the previous export, plus one added parquet
  (`strata/vaso/bins/respiratory_support/pressure_control_set_ed_ward.parquet`).
  Steps 1-2 (rules 2a-2f) applied. Consequences picked up alongside the data:
  - The export **fixed JHU's sepsis pipeline** (118,933 events vs the previous
    thousandfold-inflated 30.1M), so the JHU sepsis exclusion in
    `src/utils/siteExclusions.ts` was retired (`SITE_EXCLUSIONS` is now empty;
    machinery and tests remain, tests inject a synthetic exclusion).
  - Sepsis is no longer suppressed for the ward cohort on the dashboard
    Summary tab (`CohortSummaryFromCSV.astro`) — CDC ASE is hospital-wide, so
    the ward denominator is the right one. Ward shows it as a grey rail tile
    (after Hospital Mortality, replacing the redundant "Hospitalizations with
    an ICU stay" tile there); other cohorts keep the full sepsis card in
    Clinical Course. CRRT/vasopressor tiles stay suppressed for ward.
  - The ward cohort's picker label changed from "Overall" to "Ward-stay
    hospitalizations", with the full wording ("Inpatient hospitalizations with
    a ward stay at any point during the hospitalization") as a tooltip on the
    option and the picker control (`src/utils/cohortData.ts`,
    `src/pages/cohort_wip.astro`).
  - Tests updated for the fold/rename: sparse-denominator test retargeted to
    `Race: unknown` in the icu cohort (the folded location tails were the old
    sparse rows), and the consistency invariant accepts lowercase `: other`
    folds.
- **2026-07 (`_aggregated_old`)**: previous export; scripts introduced to make
  derivation reproducible after the hand-derived era silently dropped
  Sunnybrook from table_one files.
