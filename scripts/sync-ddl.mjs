#!/usr/bin/env node
// Copy the CLIF DDL files from the CLIF standards repo into this site.
//
// The CLIF repo (Common-Longitudinal-ICU-data-Format/CLIF, folder ddl/) is the
// source of truth. The files in src/content/v-<version>-ddl.sql are copies.
//
//   npm run sync-ddl            copy the DDL files in
//   npm run sync-ddl -- --check report differences, change nothing (exit 1 if any)
//
// The CLIF checkout is looked for at $CLIF_REPO, else ../CLIF. Files are read
// from the remote branches (after a fetch), not the working tree, so a stale or
// dirty checkout does not matter.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Which CLIF repo file feeds which site file. Mirrored in src/lib/ddl-alignment.test.ts. */
const DDL_SOURCES = [
  { ref: 'origin/3.0', from: 'ddl/3.0/CLIF3.0_MYSQL_ddl.sql', to: 'src/content/v-3-0-0-ddl.sql' },
  { ref: 'origin/main', from: 'ddl/2.1/CLIF2.1_MYSQL_ddl.sql', to: 'src/content/v-2-1-0-ddl.sql' },
  { ref: 'origin/main', from: 'ddl/2.0/CLIF2.0_MYSQL_ddl.sql', to: 'src/content/v-2-0-0-ddl.sql' },
];

const clifRepo = resolve(process.env.CLIF_REPO || join(root, '..', 'CLIF'));
const check = process.argv.includes('--check');

if (!existsSync(join(clifRepo, '.git'))) {
  console.error(`No CLIF checkout at ${clifRepo}. Set CLIF_REPO to its path.`);
  process.exit(2);
}

const git = (...args) => execFileSync('git', ['-C', clifRepo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

git('fetch', '--quiet', 'origin');

let different = 0;
for (const { ref, from, to } of DDL_SOURCES) {
  const source = git('show', `${ref}:${from}`);
  const target = join(root, to);
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (source === current) {
    console.log(`same     ${to}`);
    continue;
  }
  different += 1;
  if (check) {
    console.log(`DIFFERS  ${to}  (from ${ref}:${from})`);
  } else {
    writeFileSync(target, source);
    console.log(`updated  ${to}  (from ${ref}:${from})`);
  }
}

if (check && different > 0) {
  console.log('\nRun `npm run sync-ddl` to copy the CLIF repo DDL into the site.');
  process.exit(1);
}
if (!check && different > 0) {
  console.log('\nNow update the Example tables, ERD, groupings, POC list and change log, then run `npm test` and `npm run build`.');
}
