// Which sites actually populate each mCIDE value.
//
// The explorer presents 1,402 concepts as a flat catalogue, where a value ten
// sites write daily looks identical to one no site has ever written a row to.
// The CLIF TableOne run of May 2026 asked each site which mCIDE values it
// populates; joining that answer to the explorer separates adopted standard
// from aspirational placeholder.
//
// Box is unreachable from Vercel's build, so this is run by hand when a new
// TableOne run lands and its output is committed. Reading the per-site folders
// rather than the pre-merged `_aggregated/overall/mcide` is deliberate: that
// merge has uneven site columns across files (vitals carries 9, labs 10), and
// `_aggregated/tableone/mcide` is a stale UMN-only copy.
//
// Only the official schema is emitted. A value a site populates that is not in
// the mCIDE has no node to render on, so it is dropped here and recorded in a
// local off-schema report for offline review — the report never ships.
//
// Usage:
//   node scripts/build-mcide-coverage.mjs [--box <dir>] [--out <file>] [--report <file>]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const REPO = process.cwd();

const DEFAULT_BOX = path.join(
  process.env.HOME ?? '',
  'Library/CloudStorage/Box-Box/CLIF/Projects/CLIF-TableOne-2026'
);
const DEFAULT_OUT = path.join(REPO, 'public/data/mcide/mcide_coverage.json');
const DEFAULT_REPORT = path.join(REPO, 'scripts/.out/mcide-offschema.csv');
const CONCEPTS = path.join(REPO, 'public/data/mcide/mcide_concepts.json');

/** Provenance shown in the explorer. Update when a newer run is ingested. */
const RUN = { label: 'CLIF TableOne, May 2026', mcide_version: '2.1' };

/**
 * Columns holding an mCIDE category value.
 *
 * Nearly all end in `_category`, but two fields the explorer graphs do not
 * (`location_type`, `assessment_group`), and matching only on the suffix would
 * silently drop them.
 */
const EXTRA_CATEGORY_COLUMNS = new Set(['location_type', 'assessment_group']);

/**
 * Fields the run collected under a name the explorer no longer uses.
 *
 * Explicit, never fuzzy: a rename should be a one-line edit here, not a
 * matching heuristic that quietly starts or stops firing. Without the RRT
 * entry the run's 61 `crrt_therapy` rows go unmatched and the explorer renders
 * all five renal replacement modes as values no site uses.
 */
const FIELD_ALIASES = new Map([
  ['crrt_therapy.crrt_mode_category', 'renal_replacement_therapy.mode_category'],
]);

/**
 * Values that mean "this site mapped nothing here", not a populated category.
 *
 * Every token here must be one the mCIDE does not itself define, or real usage
 * gets thrown away and the value renders as one no site populates. `unknown`
 * and `na` both look like placeholders and are both real mCIDE values —
 * `patient.race_category.Unknown` and `susceptibility_category.NA` — so they
 * are deliberately absent. `NULLISH_COLLIDES_WITH_MCIDE` in the tests holds
 * this line.
 */
const NULLISH = new Set(['', 'nan', 'n/a', 'null', 'none', 'no_mapping']);

export { NULLISH };

/** Sites whose folder exists but which contributed no mcide export to this run. */
function hasMcideExport(boxDir, site) {
  const dir = path.join(boxDir, site, 'final', 'overall', 'mcide');
  return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.csv'));
}

/**
 * Table name for an mcide CSV.
 *
 * The filename is the table followed by the columns it carries, e.g.
 * `labs_lab_name_lab_category_lab_loinc_code_mcide.csv`. Stripping every
 * column name leaves the table. The `clif_` prefix some exports carry is not
 * part of the table name in the explorer's concept ids.
 */
export function tableNameFor(fileBase, columns) {
  let name = fileBase.replace(/_mcide$/, '');
  // Longest first, so `lab_category` cannot be partly eaten by `lab_name`.
  for (const col of [...columns].sort((a, b) => b.length - a.length)) {
    name = name.replace(`_${col}`, '');
  }
  return name.replace(/^clif_/, '');
}

/** The columns of a CSV that hold mCIDE category values. */
export function categoryColumnsFor(columns) {
  return columns.filter((c) => c.endsWith('_category') || EXTRA_CATEGORY_COLUMNS.has(c));
}

/** `table.field`, after resolving any rename. */
export function resolveField(table, column) {
  const key = `${table}.${column}`;
  return FIELD_ALIASES.get(key) ?? key;
}

/** Whether a cell names a populated mCIDE category. */
export function isPopulated(value) {
  return !NULLISH.has(String(value ?? '').trim().toLowerCase());
}

function parseArgs(argv) {
  const args = { box: DEFAULT_BOX, out: DEFAULT_OUT, report: DEFAULT_REPORT };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i].replace(/^--/, '');
    if (flag in args && argv[i + 1]) args[flag] = argv[i + 1];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.box)) {
    console.error(`Box folder not found: ${args.box}`);
    console.error('Pass --box <dir> if it is mounted elsewhere.');
    process.exit(1);
  }

  const concepts = JSON.parse(fs.readFileSync(CONCEPTS, 'utf8'));

  // The official schema, as the explorer graphs it. Lower-cased for lookup
  // because site exports vary in case; the emitted id keeps the concept's own
  // spelling so it joins to the graph node.
  const officialByField = new Map(); // 'table.field' -> Map(lowerValue -> conceptId)
  for (const c of concepts) {
    const field = `${c.table_name}.${c.field_name}`;
    if (!officialByField.has(field)) officialByField.set(field, new Map());
    officialByField.get(field).set(String(c.value).toLowerCase(), c.concept_id);
  }

  const sites = fs
    .readdirSync(args.box)
    .filter((d) => !d.startsWith('_') && !d.startsWith('.'))
    .filter((d) => fs.statSync(path.join(args.box, d)).isDirectory())
    .filter((d) => hasMcideExport(args.box, d))
    .sort();

  const measuredFields = new Set();
  const coverage = new Map(); // conceptId -> Set(siteIndex)
  const offSchema = new Map(); // `${field}\t${value}` -> Set(site)

  for (const [siteIndex, site] of sites.entries()) {
    const dir = path.join(args.box, site, 'final', 'overall', 'mcide');
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
      const rows = parse(fs.readFileSync(path.join(dir, file), 'utf8'), {
        columns: true,
        skip_empty_lines: true,
        bom: true,
      });
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const table = tableNameFor(path.basename(file, '.csv'), columns);
      const categoryColumns = categoryColumnsFor(columns);

      for (const column of categoryColumns) {
        const field = resolveField(table, column);
        // A field counts as measured once a site exported the column at all —
        // including when every row is blank. That is what separates "surveyed,
        // nobody populates it" from "never surveyed".
        if (officialByField.has(field)) measuredFields.add(field);

        const official = officialByField.get(field);
        for (const row of rows) {
          const raw = row[column];
          if (!isPopulated(raw)) continue;
          const value = String(raw).trim();
          const conceptId = official?.get(value.toLowerCase());
          if (conceptId) {
            if (!coverage.has(conceptId)) coverage.set(conceptId, new Set());
            coverage.get(conceptId).add(siteIndex);
          } else {
            const key = `${field}\t${value}`;
            if (!offSchema.has(key)) offSchema.set(key, new Set());
            offSchema.get(key).add(site);
          }
        }
      }
    }
  }

  const output = {
    run: RUN,
    sites,
    measured_fields: [...measuredFields].sort(),
    coverage: Object.fromEntries(
      [...coverage.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, set]) => [id, [...set].sort((a, b) => a - b)])
    ),
  };

  assertSane(output, concepts);

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`);

  writeOffSchemaReport(args.report, offSchema);
  reportCounts(output, concepts, offSchema);
}

/**
 * Refuse to ship output that disagrees with what the run actually contains.
 *
 * A coverage file is read as fact by anyone looking at the explorer, and its
 * failure mode is silent: a broken alias or a moved folder yields a smaller,
 * perfectly well-formed file that simply calls more of the mCIDE dead.
 */
function assertSane(output, concepts) {
  const problems = [];

  if (output.sites.length === 0) {
    problems.push('no sites found — check the --box path and folder layout');
  }

  const conceptIds = new Set(concepts.map((c) => c.concept_id));
  const strays = Object.keys(output.coverage).filter((id) => !conceptIds.has(id));
  if (strays.length > 0) {
    problems.push(`${strays.length} coverage ids are not in the mCIDE: ${strays.slice(0, 3).join(', ')}`);
  }

  // The canary for FIELD_ALIASES. This field is only ever populated through the
  // crrt_therapy alias, so if it is empty the rename mapping has broken.
  const rrt = Object.keys(output.coverage).filter((id) =>
    id.startsWith('renal_replacement_therapy.mode_category.')
  );
  if (output.measured_fields.includes('renal_replacement_therapy.mode_category') && rrt.length === 0) {
    problems.push('renal_replacement_therapy.mode_category has no coverage — FIELD_ALIASES likely stale');
  }

  if (problems.length > 0) {
    console.error('Refusing to write coverage:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

/** Values sites populate that the mCIDE does not define. Local only. */
function writeOffSchemaReport(file, offSchema) {
  const rows = [...offSchema.entries()]
    .map(([key, sites]) => {
      const [field, value] = key.split('\t');
      return { field, value, sites: [...sites].sort() };
    })
    .sort((a, b) => b.sites.length - a.sites.length || a.field.localeCompare(b.field));

  const csv = [
    'field,value,site_count,sites',
    ...rows.map((r) => `${r.field},"${r.value.replace(/"/g, '""')}",${r.sites.length},"${r.sites.join(' ')}"`),
  ].join('\n');

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${csv}\n`);
}

function reportCounts(output, concepts, offSchema) {
  const measured = new Set(output.measured_fields);
  let used = 0;
  let unused = 0;
  let notMeasured = 0;
  for (const c of concepts) {
    const field = `${c.table_name}.${c.field_name}`;
    if (!measured.has(field)) notMeasured += 1;
    else if (output.coverage[c.concept_id]) used += 1;
    else unused += 1;
  }

  console.log(`sites (${output.sites.length}): ${output.sites.join(', ')}`);
  console.log(`fields measured: ${output.measured_fields.length}`);
  console.log(`used by >=1 site: ${used}`);
  console.log(`surveyed, unused: ${unused}`);
  console.log(`never surveyed:   ${notMeasured}`);
  console.log(`off-schema values: ${offSchema.size} (local report only)`);
}

// Only run when invoked directly, so the parsing helpers can be unit tested.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
