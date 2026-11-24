// @vitest-environment node
//
// Keeps everything that mirrors the CLIF DDL in step with it.
//
// Source of truth: the CLIF standards repo (ddl/ folder). The site's
// src/content/v-<version>-ddl.sql files are copies (see scripts/sync-ddl.mjs),
// and the data dictionary's column tables are rendered straight from them.
// These tests cover the copies kept around them: the table groupings, the
// markdown sections and Example tables, the ERD and the POC list.
// scripts/sync-ddl-mirrors.mjs brings those back in step after a DDL change.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CLIF_TABLES } from '../data/clif-tables';
import tablePoc from '../data/table-poc.json';
import { parseDdl as parseDdlFile } from '../../scripts/lib/parse-ddl.mjs';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** Column lists by table, parsed with the same rules as the data dictionary pages. */
function parseDdl(ddl: string): Record<string, { name: string; type: string }[]> {
  return Object.fromEntries(Object.entries(parseDdlFile(ddl)).map(([table, { columns }]) => [table, columns]));
}

/** Markdown `## table_name` sections, as the data dictionary pages split them. */
function markdownSections(md: string): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  for (const line of md.split('\n')) {
    const heading = line.match(/^##\s+([A-Za-z0-9_ ]+)/);
    if (heading) {
      current = heading[1].trim().replace(/ /g, '_').replace(/[^A-Za-z0-9_]/g, '');
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  return sections;
}

/** Header cells of every markdown table in a section. */
function tableHeaders(lines: string[]): string[][] {
  const headers: string[][] = [];
  lines.forEach((line, i) => {
    if (line.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      headers.push(
        line
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim().replace(/[`*]/g, '').replace(/\\_/g, '_')),
      );
    }
  });
  return headers;
}

const GROUP_HEADINGS = new Set([
  'CLIF_Data_Dictionary',
  'Beta_Tables',
  'Alpha_Tables',
  'Concept_Tables',
  'Future_Proposed_Tables',
]);

const VERSIONS = [
  { key: '3.0', ddl: 'src/content/v-3-0-0-ddl.sql', md: 'src/content/clif-data-dictionary-3.0.0.md' },
  { key: '2.1', ddl: 'src/content/v-2-1-0-ddl.sql', md: 'src/content/clif-data-dictionary-2.1.0.md' },
];

for (const version of VERSIONS) {
  describe(`CLIF ${version.key} mirrors the DDL`, () => {
    const ddlText = read(version.ddl);
    const tables = parseDdl(ddlText);
    const ddlNames = Object.keys(tables).sort();
    const groups = CLIF_TABLES[version.key];
    const grouped = [...groups.beta, ...groups.alpha, ...groups.concept, ...groups.futureProposed].sort();

    it('every CREATE TABLE in the DDL is parsed (a `;` inside a COMMENT drops a table)', () => {
      const declared = [...ddlText.matchAll(/CREATE TABLE ([a-zA-Z0-9_]+)/gi)].map((m) => m[1]).sort();
      expect(ddlNames).toEqual(declared);
    });

    it('no table has the same column twice', () => {
      for (const [table, columns] of Object.entries(tables)) {
        const names = columns.map((c) => c.name);
        expect(new Set(names).size, table).toBe(names.length);
      }
    });

    it('clif-tables.ts groups exactly the DDL tables, each once', () => {
      expect(grouped).toEqual(ddlNames);
    });

    it('the markdown has one section per DDL table and no others', () => {
      const sections = Object.keys(markdownSections(read(version.md)))
        .filter((name) => !GROUP_HEADINGS.has(name))
        .sort();
      expect(sections).toEqual(ddlNames);
    });
  });
}

describe('CLIF 3.0 Example tables, ERD and POC list', () => {
  const tables = parseDdl(read('src/content/v-3-0-0-ddl.sql'));
  const sections = markdownSections(read('src/content/clif-data-dictionary-3.0.0.md'));
  const groups = CLIF_TABLES['3.0'];

  it('every Example table has exactly the DDL columns, in DDL order', () => {
    for (const [table, columns] of Object.entries(tables)) {
      const names = columns.map((c) => c.name);
      const headers = tableHeaders(sections[table] ?? []);
      // The table that shares the most headers with the schema is the Example
      // (other tables in a section are reference lists, not rows of data).
      const overlap = (h: string[]) => h.filter((x) => names.includes(x)).length;
      const example = headers.sort((x, y) => overlap(y) - overlap(x))[0];
      expect(example, `${table} Example`).toEqual(names);
    }
  });

  const erdHtml = read('public/images/data-dictionary/clif_erd_3.0.0.html');
  const erdTables: { n: string; m: string; cols: string[][] }[] = JSON.parse(
    erdHtml.match(/const TABLES = (\[[\s\S]*?\n\]);/)![1],
  );

  it('the ERD shows exactly the DDL tables and columns, in DDL order', () => {
    expect(erdTables.map((t) => t.n).sort()).toEqual(Object.keys(tables).sort());
    for (const erd of erdTables) {
      expect(
        erd.cols.map((c) => c[0]),
        erd.n,
      ).toEqual(tables[erd.n].map((c) => c.name));
    }
  });

  it('the ERD column types match the DDL', () => {
    for (const erd of erdTables) {
      expect(
        erd.cols.map((c) => c[1]),
        erd.n,
      ).toEqual(tables[erd.n].map((c) => c.type.replace(/\(.*/, '').toLowerCase()));
    }
  });

  it('the ERD maturity matches clif-tables.ts', () => {
    // The ERD has no "future proposed" level and draws those tables as concept.
    const maturity = (name: string) =>
      groups.beta.includes(name) ? 'beta' : groups.alpha.includes(name) ? 'alpha' : 'concept';
    for (const erd of erdTables) expect(erd.m, erd.n).toBe(maturity(erd.n));
  });

  it('every 3.0 table has a row in table-poc.json', () => {
    const pocTables = new Set(tablePoc.map((row) => row.table));
    expect(Object.keys(tables).filter((name) => !pocTables.has(name))).toEqual([]);
  });
});

// The site's DDL files must equal the CLIF repo's. This needs a CLIF checkout
// next to this repo (or at $CLIF_REPO), so it is skipped where there is none,
// such as on the deploy host. It reads the last fetched remote branches.
// `npm run sync-ddl` fetches and copies the files in.
const clifRepo = resolve(process.env.CLIF_REPO || join(root, '..', 'CLIF'));
const DDL_SOURCES = [
  { ref: 'origin/3.0', from: 'ddl/3.0/CLIF3.0_MYSQL_ddl.sql', to: 'src/content/v-3-0-0-ddl.sql' },
  { ref: 'origin/main', from: 'ddl/2.1/CLIF2.1_MYSQL_ddl.sql', to: 'src/content/v-2-1-0-ddl.sql' },
  { ref: 'origin/main', from: 'ddl/2.0/CLIF2.0_MYSQL_ddl.sql', to: 'src/content/v-2-0-0-ddl.sql' },
];

describe.skipIf(!existsSync(join(clifRepo, '.git')))('site DDL copies equal the CLIF repo DDL', () => {
  for (const { ref, from, to } of DDL_SOURCES) {
    it(`${to} equals ${ref}:${from}`, () => {
      const source = execFileSync('git', ['-C', clifRepo, 'show', `${ref}:${from}`], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
      expect(read(to) === source, `${to} differs from the CLIF repo. Run \`npm run sync-ddl\`.`).toBe(true);
    });
  }
});
