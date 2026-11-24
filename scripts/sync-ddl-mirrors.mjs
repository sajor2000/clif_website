#!/usr/bin/env node
// Bring everything that mirrors the CLIF 3.0 DDL back in step with it:
// the table groupings, the POC list, the ERD, the markdown Example tables and
// the change log. Run it after `npm run sync-ddl` has copied a new DDL in.
//
//   npm run sync-ddl-mirrors                  update the mirror files
//   npm run sync-ddl-mirrors -- --check       report what would change, write nothing
//   ... -- --base <git ref>                   DDL to compare against for the change log (default HEAD)
//   ... -- --notes <file>                     also write the "still needs a person" list there
//
// It fills in what the DDL determines. What it cannot know (a new table's
// maturity, POC, sample values, ERD group, a change-log issue link, whether a
// drop plus an add was a rename) gets a safe default and a line in the notes.
// Only 3.0 is handled: 2.0 and 2.1 are released and change by hand.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDdl } from './lib/parse-ddl.mjs';
import {
  diffDdl,
  readGroups,
  renameNotes,
  updateChangeLog,
  updateErd,
  updateGroupings,
  updateMarkdown,
  updatePoc,
} from './lib/ddl-mirrors.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = {
  ddl: 'src/content/v-3-0-0-ddl.sql',
  groupings: 'src/data/clif-tables.ts',
  poc: 'src/data/table-poc.json',
  erd: 'public/images/data-dictionary/clif_erd_3.0.0.html',
  markdown: 'src/content/clif-data-dictionary-3.0.0.md',
  changeLog: 'src/pages/data-dictionary/change-log.astro',
};

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const check = args.includes('--check');
const base = option('--base') ?? 'HEAD';
const notesFile = option('--notes');

const read = (path) => readFileSync(join(root, path), 'utf8');
const original = Object.fromEntries(Object.entries(FILES).map(([key, path]) => [key, read(path)]));

const tables = parseDdl(original.ddl);
const declared = [...original.ddl.matchAll(/CREATE TABLE ([a-zA-Z0-9_]+)/gi)].map((m) => m[1]);
const unparsed = declared.filter((name) => !tables[name]);
if (unparsed.length > 0) {
  // Usually a `;` inside a COMMENT. Updating the mirrors now would delete these tables from them.
  console.error(`Cannot parse ${unparsed.join(', ')} in ${FILES.ddl}. Nothing was changed.`);
  process.exit(2);
}

const before = parseDdl(
  execFileSync('git', ['-C', root, 'show', `${base}:${FILES.ddl}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
);
const diff = diffDdl(before, tables);
// The site runs on Chicago time; the runner does not.
const today = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date());

const next = {};
const notes = [];
const apply = (key, result) => {
  next[key] = result.text;
  notes.push(...result.notes);
};

const betaBefore = readGroups(original.groupings).beta;
apply('groupings', updateGroupings(original.groupings, tables));
const groups = readGroups(next.groupings);
apply('poc', updatePoc(original.poc, tables, diff.removedTables));
apply('erd', updateErd(original.erd, tables, groups));
apply('markdown', updateMarkdown(original.markdown, tables, groups));
apply('changeLog', updateChangeLog(original.changeLog, diff, betaBefore, today));
notes.push(...renameNotes(diff));

let changed = 0;
for (const [key, text] of Object.entries(next)) {
  if (text === original[key]) continue;
  changed += 1;
  if (!check) writeFileSync(join(root, FILES[key]), text);
  console.log(`${check ? 'WOULD UPDATE' : 'updated'}  ${FILES[key]}`);
}
if (changed === 0) console.log('The 3.0 mirrors already match the DDL.');

if (notes.length > 0) {
  console.log('\nStill needs a person:');
  for (const note of notes) console.log(`- ${note}`);
}
if (notesFile)
  writeFileSync(
    notesFile,
    notes.map((note) => `- ${note}`).join('\n') + (notes.length > 0 ? '\n' : '')
  );
if (check && changed > 0) process.exit(1);
