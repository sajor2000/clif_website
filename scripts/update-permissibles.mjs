#!/usr/bin/env node
/**
 * Generic permissible-values updater.
 * Reads SOURCES config, fetches each CSV, extracts the designated column,
 * then rewrites every DDL file passed on the command line so that the
 * JSON comment for the matching column contains an up-to-date list.
 */
import { readFile, writeFile } from 'fs/promises';
import { parse } from 'csv-parse/sync';
import { SOURCES } from './permissible-sources.js';

async function fetchCsv(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
  return res.text();
}

async function buildMaps() {
  const maps = {};
  await Promise.all(
    SOURCES.map(async (src) => {
      const text = await fetchCsv(src.csv);
      const rows = parse(text, { columns: true });
      const vals = Array.from(
        new Set(rows.map((r) => String(r[src.csvColumn] || '').trim().toLowerCase()))
      ).filter(Boolean).sort();
      maps[src.csv] = vals;
    })
  );
  return maps;
}

async function updateFile(path, maps) {
  let ddl = await readFile(path, 'utf8');
  for (const src of SOURCES) {
    const list = maps[src.csv];
    if (!list) continue;
    const replacement = list.join(', ');
    ddl = ddl.replace(src.columnRegex, `$1${replacement}$2`);
  }
  await writeFile(path, ddl);
  console.log('✔ updated', path);
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: update-permissibles <ddl-file ...>');
    process.exit(1);
  }

  const maps = await buildMaps();
  await Promise.all(files.map((f) => updateFile(f, maps)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});