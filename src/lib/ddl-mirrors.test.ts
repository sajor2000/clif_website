// @vitest-environment node
//
// scripts/lib/ddl-mirrors.mjs: after a DDL change, the mirror files must again
// satisfy what ddl-alignment.test.ts asks of them. Each case edits a copy of
// the real 3.0 DDL in memory and runs the real mirror files through the script.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDdl, shortType } from '../../scripts/lib/parse-ddl.mjs';
import {
  diffDdl,
  readGroups,
  renameNotes,
  updateChangeLog,
  updateErd,
  updateGroupings,
  updateMarkdown,
  updatePoc,
} from '../../scripts/lib/ddl-mirrors.mjs';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const files = {
  ddl: read('src/content/v-3-0-0-ddl.sql'),
  groupings: read('src/data/clif-tables.ts'),
  poc: read('src/data/table-poc.json'),
  erd: read('public/images/data-dictionary/clif_erd_3.0.0.html'),
  markdown: read('src/content/clif-data-dictionary-3.0.0.md'),
  changeLog: read('src/pages/data-dictionary/change-log.astro'),
};
const DATE = 'Jan 2, 2027';

/** What scripts/sync-ddl-mirrors.mjs does, on in-memory text. */
function run(ddl: string) {
  const before = parseDdl(files.ddl);
  const tables = parseDdl(ddl);
  const diff = diffDdl(before, tables);
  const notes: string[] = [];
  const take = (result: { text: string; notes: string[] }) => {
    notes.push(...result.notes);
    return result.text;
  };
  const groupings = take(updateGroupings(files.groupings, tables));
  const groups = readGroups(groupings);
  const out = {
    groupings,
    poc: take(updatePoc(files.poc, tables, diff.removedTables)),
    erd: take(updateErd(files.erd, tables, groups)),
    markdown: take(updateMarkdown(files.markdown, tables, groups)),
    changeLog: take(updateChangeLog(files.changeLog, diff, readGroups(files.groupings).beta, DATE)),
  };
  notes.push(...renameNotes(diff));
  return { tables, groups, out, notes };
}

const erdData = (html: string) => ({
  nodes: JSON.parse(html.match(/const TABLES = (\[[\s\S]*?\n\]);/)![1]) as {
    n: string;
    m: string;
    g: string;
    cols: string[][];
  }[],
  refs: JSON.parse(html.match(/const REFS = (\[.*\]);/)![1]) as string[][],
  domains: JSON.parse(html.match(/const DOMAIN_ORDER = (\[.*\]);/)![1]) as string[],
});

/** The Example header of a table's markdown section. */
function exampleHeader(md: string, table: string, names: string[]): string[] {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${table}`);
  expect(start, `${table} section`).toBeGreaterThan(-1);
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end === -1) end = lines.length;
  const headers = lines
    .slice(start, end)
    .filter(
      (l, i, all) => l.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(all[i + 1] ?? '')
    )
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim().replace(/[`*]/g, '').replace(/\\_/g, '_'))
    );
  const overlap = (h: string[]) => h.filter((x) => names.includes(x)).length;
  return headers.sort((a, b) => overlap(b) - overlap(a))[0];
}

/** The same checks ddl-alignment.test.ts makes, on the script's output. */
function expectAligned({ tables, groups, out }: ReturnType<typeof run>) {
  const ddlNames = Object.keys(tables).sort();
  expect(
    [...groups.beta, ...groups.alpha, ...groups.concept, ...groups.futureProposed].sort()
  ).toEqual(ddlNames);

  const poc = new Set((JSON.parse(out.poc) as { table: string }[]).map((r) => r.table));
  expect(ddlNames.filter((n) => !poc.has(n))).toEqual([]);

  const { nodes, refs, domains } = erdData(out.erd);
  expect(nodes.map((n) => n.n).sort()).toEqual(ddlNames);
  for (const node of nodes) {
    expect(
      node.cols.map((c) => c[0]),
      node.n
    ).toEqual(tables[node.n].columns.map((c) => c.name));
    expect(
      node.cols.map((c) => c[1]),
      node.n
    ).toEqual(tables[node.n].columns.map((c) => shortType(c.type)));
    expect(domains, node.n).toContain(node.g);
  }
  for (const [from, to] of refs) {
    expect(tables[from], `line from ${from}`).toBeDefined();
    expect(tables[to], `line to ${to}`).toBeDefined();
  }

  for (const name of ddlNames) {
    const names = tables[name].columns.map((c) => c.name);
    expect(exampleHeader(out.markdown, name, names), `${name} Example`).toEqual(names);
  }
}

const logCount = (astro: string, label: string) => {
  const section = astro.slice(
    astro.search(/Version 3\.0/),
    astro.indexOf('<!-- Version 2.1.0 -->')
  );
  const at = section.indexOf(`${label} (`);
  const stated = Number(section.slice(at).match(/\((\d+)/)![1]);
  const body = section.slice(section.indexOf('<tbody', at), section.indexOf('</tbody>', at));
  return { stated, rows: (body.match(/<tr[\s>]/g) ?? []).length };
};

const NEW_COLUMN = `  map_source VARCHAR COMMENT '{"description": "Where the value came from, e.g. {arterial line} <cuff>. See [the guide](https://example.org/guide)", "permissible": "No restriction"}',\n`;

describe('ddl-mirrors', () => {
  it('changes nothing when the DDL has not changed', () => {
    const result = run(files.ddl);
    expect(result.out).toEqual({
      groupings: files.groupings,
      poc: files.poc,
      erd: files.erd,
      markdown: files.markdown,
      changeLog: files.changeLog,
    });
    expect(result.notes).toEqual([]);
  });

  it('a new column on a beta table reaches the ERD, the Example and the change log', () => {
    const ddl = files.ddl.replace(/(CREATE TABLE vitals\s*\(\n)/, `$1${NEW_COLUMN}`);
    const result = run(ddl);
    expect(result.tables.vitals.columns[0].name).toBe('map_source');
    expectAligned(result);

    // Existing Example rows keep their values; the new cell is blank.
    const vitals = result.out.markdown.slice(result.out.markdown.indexOf('\n## vitals'));
    const firstRow = vitals.split('\n').filter((l) => l.startsWith('|'))[2];
    expect(firstRow.startsWith('|  | ')).toBe(true);
    expect(firstRow.split('|').length).toBe(result.tables.vitals.columns.length + 2);

    const before = logCount(files.changeLog, 'New Fields');
    const after = logCount(result.out.changeLog, 'New Fields');
    expect(after.rows).toBe(before.rows + 1);
    expect(after.stated).toBe(after.rows);
    expect(result.out.changeLog).toContain(
      '<td class="px-4 py-3 text-sm font-mono">map_source</td>'
    );
    // Astro would read a bare { } as an expression and a bare < as a tag.
    expect(result.out.changeLog).toContain('e.g. &#123;arterial line&#125; &lt;cuff&gt;.');
    expect(result.out.changeLog).toContain(
      '<a href="https://example.org/guide" class="text-clif-burgundy hover:underline">the guide</a>'
    );
    expect(result.out.changeLog).toContain(
      `New Fields (${after.rows} fields added) <span class="text-sm font-normal text-gray-600 ml-2">Last updated: ${DATE}</span>`
    );
    expect(result.out.changeLog).toContain(`(Last updated: ${DATE})`);
    expect(logCount(result.out.changeLog, 'Revisions')).toEqual(
      logCount(files.changeLog, 'Revisions')
    );
    expect(result.notes.some((n) => n.includes('vitals.map_source'))).toBe(true);
  });

  it('a new column on a non-beta table is not logged (the log covers beta tables only)', () => {
    const ddl = files.ddl.replace(/(CREATE TABLE airway\s*\(\n)/, `$1${NEW_COLUMN}`);
    const result = run(ddl);
    expectAligned(result);
    expect(result.out.changeLog).toBe(files.changeLog);
  });

  it('a dropped column and a type change on a beta table become Revisions rows', () => {
    const vitals = parseDdl(files.ddl).vitals.columns;
    const dropped = vitals[vitals.length - 1].name;
    const retyped = vitals[1];
    const ddl = files.ddl.replace(/CREATE TABLE vitals\s*\([^;]*?\);/s, (block) =>
      block
        .split('\n')
        .filter((line) => !line.trim().startsWith(`${dropped} `))
        .map((line) =>
          line.trim().startsWith(`${retyped.name} `) ? line.replace(retyped.type, 'BOOLEAN') : line
        )
        .join('\n')
    );
    const result = run(ddl);
    expect(result.tables.vitals.columns.map((c) => c.name)).not.toContain(dropped);
    expectAligned(result);

    const before = logCount(files.changeLog, 'Revisions');
    const after = logCount(result.out.changeLog, 'Revisions');
    expect(after.rows).toBe(before.rows + 2);
    expect(after.stated).toBe(after.rows);
    expect(result.out.changeLog).toContain(
      `Dropped <code>${dropped}</code> from <code>vitals</code>.`
    );
    expect(result.out.changeLog).toContain(
      `Changed the type of <code>vitals.${retyped.name}</code> from ${retyped.type} to BOOLEAN.`
    );
  });

  it('a drop plus an add on one table is flagged as a possible rename', () => {
    const first = parseDdl(files.ddl).vitals.columns[2].name;
    const ddl = files.ddl.replace(/CREATE TABLE vitals\s*\([^;]*?\);/s, (block) =>
      block.replace(`  ${first} `, `  ${first}_new `)
    );
    const result = run(ddl);
    expectAligned(result);
    expect(result.notes.some((n) => n.includes('If this was a rename'))).toBe(true);
  });

  it('a new table is added everywhere with safe defaults', () => {
    const ddl = `${files.ddl}\nCREATE TABLE nutrition (\n  hospitalization_id VARCHAR COMMENT '{"description": "x", "permissible": "y"}',\n  recorded_dttm DATETIME COMMENT '{"description": "x", "permissible": "y"}',\n  kcal DOUBLE COMMENT '{"description": "x", "permissible": "y"}'\n);\n`;
    const result = run(ddl);
    expectAligned(result);

    expect(result.groups.concept).toContain('nutrition');
    expect(JSON.parse(result.out.poc)).toContainEqual({ table: 'nutrition', poc: '' });
    const { nodes, refs, domains } = erdData(result.out.erd);
    expect(nodes.find((n) => n.n === 'nutrition')).toMatchObject({
      m: 'concept',
      g: 'Other',
      cols: [
        ['hospitalization_id', 'varchar', 'fk'],
        ['recorded_dttm', 'datetime'],
        ['kcal', 'double'],
      ],
    });
    expect(domains).toContain('Other');
    expect(refs).toContainEqual(['nutrition', 'hospitalization']);

    // The stub section sits inside Concept Tables, in name order.
    const md = result.out.markdown;
    const at = md.indexOf('\n## nutrition\n');
    expect(at).toBeGreaterThan(md.indexOf('\n## Concept Tables'));
    expect(at).toBeLessThan(md.indexOf('\n## Future Proposed Tables'));
    expect(at).toBeGreaterThan(md.indexOf('\n## line\n'));
    expect(at).toBeLessThan(md.indexOf('\n## patient_attributes\n'));

    expect(result.out.changeLog).toBe(files.changeLog);
    expect(result.notes.length).toBeGreaterThanOrEqual(4);
  });

  it('a dropped table is removed everywhere, with its relationship lines', () => {
    const ddl = files.ddl.replace(/CREATE TABLE model_registry\s*\([^;]*?\);/s, '');
    const result = run(ddl);
    expect(result.tables.model_registry).toBeUndefined();
    expectAligned(result);

    expect(result.out.markdown).not.toContain('\n## model_registry\n');
    expect(result.out.groupings).not.toContain("'model_registry'");
    expect((JSON.parse(result.out.poc) as { table: string }[]).map((r) => r.table)).not.toContain(
      'model_registry'
    );
    const { nodes, refs } = erdData(result.out.erd);
    expect(refs.flat()).not.toContain('model_registry');
    // scores.model_id pointed at the dropped table, so it is no longer a key.
    expect(nodes.find((n) => n.n === 'scores')!.cols.find((c) => c[0] === 'model_id')).toHaveLength(
      2
    );
    // A POC row the DDL never had (provider) is left alone.
    expect((JSON.parse(result.out.poc) as { table: string }[]).map((r) => r.table)).toContain(
      'provider'
    );
  });
});
