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
| `src/data/cohorts/` | tracked | Derived table_one + ancillary CSVs → `/cohort` |
| `src/data/cohort_ecdf/` | tracked | Derived ECDF CSVs → `/cohort` Distributions tab |

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
   python3 scripts/refresh-cohort-ecdf.py               # writes src/data/cohort_ecdf/
   ```
   Both scripts fail loudly on missing sources/sites — that is the point;
   do not paper over a MISSING SOURCE error.
4. **Verify**: diff the derived dirs (site columns all present, row counts
   plausible), `npm run build`, spot-check `/cohort`.
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
an unexpected new label stays visible): fold `unknown`, `failed_attempt`,
and `discharged_on_imv` into `Extubation outcome: other`; `extubated` and
`death_on_imv` stay. `discharged_on_imv` joined the fold on 2026-08-14:
upstream extubation is inferred from a charting pattern (an IMV row followed
by two consecutive non-IMV rows — extubation_calculator.py), so that bucket
is "survived to discharge with no charted extubation" — mostly charting that
simply ended, with true vent-facility discharges an unquantifiable subset.
At ~21% of IMV hospitalizations it read as a clinical claim ("discharge on
IMV") the data cannot support.

**Rule 2f — honest labels** (after 2e): the group becomes `IMV outcome:` —
the rows describe how the IMV course resolved, not only extubation;
`death_on_imv` → `died, no extubation recorded`, `extubated` and `other`
keep their names. Values untouched — rename only.
(The earlier rename to `Terminal IMV outcome` / `discharged not on IMV` /
`discharge on IMV` was retired 2026-08-14: the status is classified from the
FIRST real ventilation episode, so it is not terminal — a patient extubated
once and later dying on the vent reads `extubated` — and "discharge on IMV"
asserted a discharge-time vent status that is not measured.) The matching
tooltip keys in `src/utils/characteristicDefinitions.ts` moved with it;
`denominatorBasis.ts` needs nothing (label-agnostic back-solver).

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

**Rule 2h — Sex and Ethnicity Other/Unknown/Missing dropped**: `Sex: Other`,
`Ethnicity: Other`, and the `Unknown`/`Missing` rows of both groups are
removed from all table_ones. Dropped rather than folded — there is no sibling
category to absorb them. `Sex: Other` is 190 patients consortium-wide (0.0%);
`Ethnicity: Other` is ~11% of encounters and was dropped by product decision
(2026-08-13), leaving Non-Hispanic / Hispanic as the ethnicity rows. The
`Unknown`/`Missing` rows joined the drop list 2026-08-17: the export already
omits them from the overall and overall_ward table_ones but ships them in the
four strata, so the strata showed rows the "All" cohort hid — dropping them
in preprocessing makes every cohort read the same (and matches the crosstab's
rule 2g treatment of its Unknown columns).

**Rule 2i — Race tail folded into Other (table_ones)**: mirrors rule 2g in
the table_ones — `Race: american indian or alaska native`,
`Race: native hawaiian or other pacific islander`, and `Race: unknown` merge
into the export's own `Race: Other` row (the fold list includes `Other`
itself so the counts sum into one row). Kept: White, Black or African
American, Asian, Other.

### Step 3 — Michigan batching repair (2026-08-14)

Michigan ran TableOne in batches after out-of-memory failures: their
`table_one_*` and `sofa_mortality_summary` files cover **2023–2024 only**
(17,135 critically-ill encounter blocks), while their `strobe_counts.csv` and
`upset_data.csv` were computed on the full multi-year database (66,799).
The two file families describe different cohorts, so publishing both broke the
consortium totals (STROBE/UpSet `__ALL` = 1,284,771 vs the table_one headline
of 1,235,107). Implemented in `scripts/preprocess-aggregated.mjs`
(`transformStrobe` / `transformUpset` / `transformSofa`):

- **Rule 3a — Michigan dropped from strobe_counts and upset_data**
  (`DROP_SITES`), and every `__ALL` recomputed from the surviving sites
  (precedent: the deaths cohort omits OHSU/UCMC/UCSF the same way). The
  strobe consortium total is now 1,217,972 = 1,235,107 − 17,135, i.e.
  self-consistently ex-Michigan. Re-include Michigan by clearing `DROP_SITES`
  once they re-run TableOne over their full range.
- **Rule 3b — strobe `*_pct` rows' `__ALL` pooled, not summed**: recomputed as
  numerator/denominator from the file's own recomputed count `__ALL`s
  (`STROBE_PCT_ROWS` maps each pct row to its count rows). The raw export
  sums site percentages, producing values like `sepsis_vaso_pct__ALL = 408`.
- **Rule 3c — SOFA split-row merge**: the upstream merge appended Michigan's
  rows under integer score labels (`0`) instead of merging with the
  float-labelled block (`0.0`), yielding 47 rows for 24 scores with two
  conflicting `__ALL`s each. Rows are merged on the numeric score (per-site
  cells are disjoint; a genuine conflict fails loudly), and every `__ALL` is
  recomputed: counts summed, `mortality_rate_percent__ALL` pooled as
  deaths/encounters, 95% CI as the normal approximation on the pooled rate
  (matches the per-site CI formula in the export). This also fixes the raw
  export's summed-percentage `__ALL` (up to 800% in the deaths stratum,
  where every site is definitionally 100%). Michigan's SOFA rows sit on the
  same 2023–24 denominator as their table_one, so they are kept.

Note: as of 2026-08-14, `strobe_counts.csv`, `upset_data.csv`,
`sofa_mortality_summary.csv`, `code_status_combined_summary.csv`,
`mortality_rates.csv`, and the `comorbidities_per_1000_*` pair are **no
longer tracked** under `src/data/cohorts/`:
their only reader (`CohortOutcomes.astro`) was dead code that never rendered,
and several carried literal sub-10 counts, which the tracked, public data
must not (this repo is public — the table_ones suppress to `<10`). The rules
above still repair `_aggregated` locally, so re-tracking them — with n<10
suppression added — is a one-line change in `refresh-cohort-tableone.mjs`
(`ANCILLARY`) when an outcomes view actually ships.

Before re-tracking `comorbidities_per_1000_*`, resolve the denominator
question upstream: the export divides by hospitalizations *with diagnosis
codes* (MIMIC: 42,782) while table_one counts all encounter blocks (MIMIC:
89,832), so the same condition reads 31.0% vs 14.8% — a legitimate methods
difference, but it must be labelled or reconciled before either number is
published beside the other.

### Step 4 — MIMIC date-shift Years repair (2026-08-14)

MIMIC's de-identification shifts dates by ~a century (its `Years` cell reads
`2110-2211`), which poisoned the consortium min-max: the table_one `Years`
`__ALL` cell read `2011-2211`. Implemented in `preprocess-aggregated.mjs`
(STEPS: "years: recompute __ALL without date-shifted sites"): each column
group's `__ALL` in the `Years` row is recomputed from the sites whose range
starts in the past (start year ≤ current year); MIMIC's own site cell keeps
its shifted range — that is what MIMIC's data really says. The consortium
cell now reads `2011-2026`. (MIMIC's encounters also appear in no real year
column, so time-series tabs inherently exclude it — that is a property of
date-shifted data, not of this rule.)

## Refresh history

- **2026-08-17 (later same day)**: rule 2h extended to drop
  `Sex/Ethnicity: Unknown` and `Missing` from all table_ones — the strata
  files carried them while the overall files never did, so the dashboard
  showed them in every cohort except "All Critically Ill". Data re-derived
  (only those 4 rows × 4 strata changed); the denominator-basis sparse-row
  test now synthesizes its sparse case, since no shipped row sits below the
  evidence bar any more.
- **2026-08-17**: rerun aggregation (12-site roster). UCMC's deaths-stratum
  results, absent from every earlier export, are now included — deaths gains
  UCMC across table_one, medications, crosstab, and all bins/ECDFs; the other
  cohorts pick up the rerun's refreshed numbers. An earlier same-day upload
  had regenerated the deaths files *without* UCMC — always verify the target
  stratum actually contains a newly-announced site before refreshing. The
  Michigan int/float SOFA split (rule 3c) now affects every stratum's
  `sofa_mortality_summary` (not just deaths) and the crosstab `Unknown`
  columns (rule 2g) appear in all cohorts; both repairs applied cleanly with
  no script changes.
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
    `src/pages/cohort.astro`).
  - Tests updated for the fold/rename: sparse-denominator test retargeted to
    `Race: unknown` in the icu cohort (the folded location tails were the old
    sparse rows), and the consistency invariant accepts lowercase `: other`
    folds.
- **2026-07 (`_aggregated_old`)**: previous export; scripts introduced to make
  derivation reproducible after the hand-derived era silently dropped
  Sunnybrook from table_one files.
