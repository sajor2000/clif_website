// Bring the files that mirror the CLIF 3.0 DDL back in step with it.
//
// Every function here takes file text and returns new file text plus `notes`:
// the things a script cannot know and a person still has to decide. Run on
// files that already match the DDL, each function returns its input unchanged.
//
// Used by scripts/sync-ddl-mirrors.mjs. What "in step" means is defined by
// src/lib/ddl-alignment.test.ts.

import { shortType } from './parse-ddl.mjs';

const GROUP_KEYS = ['beta', 'alpha', 'concept', 'futureProposed'];
const NEW_TABLE_GROUP = 'concept';
const NEW_TABLE_ERD_DOMAIN = 'Other';

// ---------------------------------------------------------------------------
// DDL diff
// ---------------------------------------------------------------------------

/** What changed between two parsed DDLs (see parse-ddl.mjs). */
export function diffDdl(before, after) {
  const diff = {
    addedTables: [],
    removedTables: [],
    addedColumns: [],
    removedColumns: [],
    typeChanges: [],
  };
  for (const table of Object.keys(after)) if (!before[table]) diff.addedTables.push(table);
  for (const table of Object.keys(before)) if (!after[table]) diff.removedTables.push(table);
  for (const [table, { columns }] of Object.entries(after)) {
    if (!before[table]) continue;
    const old = new Map(before[table].columns.map((c) => [c.name, c]));
    const now = new Set(columns.map((c) => c.name));
    for (const c of columns) {
      const was = old.get(c.name);
      if (!was) diff.addedColumns.push({ table, ...c });
      else if (was.type !== c.type)
        diff.typeChanges.push({ table, name: c.name, from: was.type, to: c.type });
    }
    for (const c of before[table].columns)
      if (!now.has(c.name)) diff.removedColumns.push({ table, ...c });
  }
  return diff;
}

export const isEmptyDiff = (diff) => Object.values(diff).every((list) => list.length === 0);

// ---------------------------------------------------------------------------
// src/data/clif-tables.ts
// ---------------------------------------------------------------------------

function findVersionBlock(ts, version) {
  const start = ts.indexOf(`'${version}': {`);
  if (start === -1) throw new Error(`clif-tables.ts has no '${version}' block`);
  const end = ts.indexOf('\n  },', start);
  if (end === -1) throw new Error(`clif-tables.ts '${version}' block is not closed`);
  return { start, end };
}

const groupArrayRegex = (key) => new RegExp(`(${key}:\\s*\\[)([^\\]]*)(\\])`);

/**
 * The version's table names by maturity group, read from the file text.
 * @returns {{ beta: string[], alpha: string[], concept: string[], futureProposed: string[] }}
 */
export function readGroups(ts, version = '3.0') {
  const { start, end } = findVersionBlock(ts, version);
  const block = ts.slice(start, end);
  const groups = { beta: [], alpha: [], concept: [], futureProposed: [] };
  for (const key of GROUP_KEYS) {
    const found = block.match(groupArrayRegex(key));
    groups[key] = found ? [...found[2].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  }
  return groups;
}

/** New DDL tables go in as concept; tables no longer in the DDL are taken out. */
export function updateGroupings(ts, tables, version = '3.0') {
  const notes = [];
  const { start, end } = findVersionBlock(ts, version);
  let block = ts.slice(start, end);
  const groups = readGroups(ts, version);
  const grouped = GROUP_KEYS.flatMap((key) => groups[key]);

  for (const name of grouped.filter((n) => !tables[n])) {
    block = block.replace(new RegExp(`'${name}',?[ \\t]*`), '');
  }
  const added = Object.keys(tables).filter((n) => !grouped.includes(n));
  if (added.length > 0) {
    block = block.replace(groupArrayRegex(NEW_TABLE_GROUP), (_, open, body, close) => {
      const items = added.map((n) => `'${n}'`).join(', ');
      const trailing = body.match(/\s*$/)[0];
      const kept = body.slice(0, body.length - trailing.length);
      if (kept.trim() === '') return `${open}${items}${close}`;
      return kept.endsWith(',')
        ? `${open}${kept} ${items},${trailing}${close}`
        : `${open}${kept}, ${items}${trailing}${close}`;
    });
    for (const name of added) {
      notes.push(
        `\`${name}\`: listed as a **concept** table. Move it in \`src/data/clif-tables.ts\` if it is alpha or beta.`
      );
    }
  }
  return { text: ts.slice(0, start) + block + ts.slice(end), notes };
}

// ---------------------------------------------------------------------------
// src/data/table-poc.json
// ---------------------------------------------------------------------------

/** One row per DDL table. Rows are only removed for tables this change dropped. */
export function updatePoc(json, tables, removedTables = []) {
  const notes = [];
  const rows = JSON.parse(json);
  const have = new Set(rows.map((r) => r.table));
  const added = Object.keys(tables).filter((n) => !have.has(n));
  const kept = rows.filter((r) => !removedTables.includes(r.table));
  if (added.length === 0 && kept.length === rows.length) return { text: json, notes };

  for (const name of added) {
    kept.push({ table: name, poc: '' });
    notes.push(`\`${name}\`: no point of contact yet. Add one in \`src/data/table-poc.json\`.`);
  }
  const simple = kept.every((r) => Object.keys(r).join() === 'table,poc');
  const text = simple
    ? `[\n${kept.map((r) => `  { "table": ${JSON.stringify(r.table)}, "poc": ${JSON.stringify(r.poc)} }`).join(',\n')}\n]\n`
    : `${JSON.stringify(kept, null, 2)}\n`;
  return { text, notes };
}

// ---------------------------------------------------------------------------
// public/images/data-dictionary/clif_erd_<version>.html
// ---------------------------------------------------------------------------

const ERD_TABLES = /const TABLES = (\[[\s\S]*?\n\]);/;
const ERD_REFS = /const REFS = (\[.*\]);/;
const ERD_DOMAINS = /const DOMAIN_ORDER = (\[.*\]);/;

const maturityOf = (groups, name) =>
  groups.beta.includes(name) ? 'beta' : groups.alpha.includes(name) ? 'alpha' : 'concept';

/**
 * Rebuild each node's columns from the DDL and the relationship lines from the
 * key flags. A column is a foreign key when the DDL says so, or when it has
 * the same name as another table's key column (every existing line follows
 * that rule). Which column is a table's own key is kept from the file.
 */
export function updateErd(html, tables, groups) {
  const notes = [];
  const nodes = JSON.parse(html.match(ERD_TABLES)[1]);
  const refs = JSON.parse(html.match(ERD_REFS)[1]);
  const domains = JSON.parse(html.match(ERD_DOMAINS)[1]);

  const keyOwner = {}; // key column name -> table that owns it
  for (const node of nodes) {
    if (!tables[node.n]) continue;
    for (const [col, , flag] of node.cols) {
      if (flag === 'pk' && tables[node.n].columns.some((c) => c.name === col))
        keyOwner[col] = node.n;
    }
  }

  const buildCols = (name) => {
    const explicit = new Map(tables[name].foreignKeys.map((fk) => [fk.column, fk.table]));
    const targets = [];
    const cols = tables[name].columns.map((c) => {
      const entry = [c.name, shortType(c.type)];
      if (keyOwner[c.name] === name) entry.push('pk');
      else {
        const target = explicit.get(c.name) ?? keyOwner[c.name];
        if (target && tables[target]) {
          entry.push('fk');
          targets.push(target);
        }
      }
      return entry;
    });
    return { cols, targets };
  };

  const next = [];
  const wanted = []; // every [from, to] line the columns imply
  const place = (node) => {
    const { cols, targets } = buildCols(node.n);
    next.push({ n: node.n, m: maturityOf(groups, node.n), g: node.g, cols });
    for (const to of targets) wanted.push([node.n, to]);
  };
  for (const node of nodes) {
    if (!tables[node.n]) continue;
    if (node.cols.some((c) => c[2] === 'pk') && !Object.values(keyOwner).includes(node.n)) {
      notes.push(
        `\`${node.n}\`: its key column is gone from the DDL, so the ERD no longer marks one. If it was renamed, set the \`"pk"\` flag in the ERD file.`
      );
    }
    place(node);
  }
  const known = new Set(nodes.map((node) => node.n));
  for (const name of Object.keys(tables)) {
    if (known.has(name)) continue;
    place({ n: name, g: NEW_TABLE_ERD_DOMAIN });
    if (!domains.includes(NEW_TABLE_ERD_DOMAIN)) domains.push(NEW_TABLE_ERD_DOMAIN);
    notes.push(
      `\`${name}\`: drawn in an "Other" group on the ERD with no key column. Set its \`"g"\` group and \`"pk"\` flag in \`clif_erd_3.0.0.html\`.`
    );
  }

  // Keep existing lines in their order, drop dead ones, append new ones.
  const key = (pair) => pair.join('>');
  const wantedKeys = new Set(wanted.map(key));
  const nextRefs = refs.filter((pair) => wantedKeys.has(key(pair)));
  const haveKeys = new Set(nextRefs.map(key));
  for (const pair of wanted) {
    if (!haveKeys.has(key(pair))) {
      haveKeys.add(key(pair));
      nextRefs.push(pair);
    }
  }

  const line = (value) => JSON.stringify(value).replace(/","/g, '", "').replace(/\],\[/g, '], [');
  const text = html
    .replace(ERD_TABLES, () => `const TABLES = ${JSON.stringify(next, null, 1)};`)
    .replace(ERD_REFS, () => `const REFS = ${line(nextRefs)};`)
    .replace(ERD_DOMAINS, () => `const DOMAIN_ORDER = ${line(domains)};`);
  return { text, notes };
}

// ---------------------------------------------------------------------------
// src/content/clif-data-dictionary-<version>.md
// ---------------------------------------------------------------------------

const GROUP_HEADING = {
  beta: 'Beta Tables',
  alpha: 'Alpha Tables',
  concept: 'Concept Tables',
  futureProposed: 'Future Proposed Tables',
};
const GROUP_HEADING_NAMES = new Set([
  'CLIF_Data_Dictionary',
  ...Object.values(GROUP_HEADING).map((h) => h.replace(/ /g, '_')),
]);

const headingName = (line) => {
  const heading = line.match(/^##\s+([A-Za-z0-9_ ]+)/);
  return heading
    ? heading[1]
        .trim()
        .replace(/ /g, '_')
        .replace(/[^A-Za-z0-9_]/g, '')
    : null;
};
const splitRow = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
const plain = (cell) => cell.replace(/[`*]/g, '').replace(/\\_/g, '_');
const isDivider = (line) => /^\s*\|[\s:|-]+\|\s*$/.test(line ?? '');
const row = (cells) => `| ${cells.join(' | ')} |`;

/** Sections as [{ name, start, end }] over the lines array (end exclusive). */
function sectionsOf(lines) {
  const sections = [];
  lines.forEach((line, i) => {
    const name = headingName(line);
    if (name === null) return;
    if (sections.length > 0) sections[sections.length - 1].end = i;
    sections.push({ name, start: i, end: lines.length });
  });
  return sections;
}

/** Rewrite one section's Example table so its columns are exactly `names`. */
function fixExample(sectionLines, names, table, notes) {
  const starts = [];
  sectionLines.forEach((line, i) => {
    if (line.trim().startsWith('|') && isDivider(sectionLines[i + 1])) starts.push(i);
  });
  const overlap = (i) =>
    splitRow(sectionLines[i])
      .map(plain)
      .filter((h) => names.includes(h)).length;
  const start = starts.sort((a, b) => overlap(b) - overlap(a))[0];

  if (start === undefined || overlap(start) === 0) {
    const out = [...sectionLines];
    while (out.length > 1 && out[out.length - 1].trim() === '') out.pop();
    out.push('', '**Example**:', '', row(names), row(names.map(() => '---')), '');
    notes.push(
      `\`${table}\`: had no Example table, so an empty one was added. Add sample rows in the 3.0 markdown.`
    );
    return out;
  }

  const oldHeader = splitRow(sectionLines[start]);
  const oldNames = oldHeader.map(plain);
  if (oldNames.join('|') === names.join('|')) return sectionLines;

  let end = start + 2;
  while (end < sectionLines.length && sectionLines[end].trim().startsWith('|')) end += 1;
  const from = names.map((n) => oldNames.indexOf(n));
  const remap = (cells, blank) => from.map((i, k) => (i === -1 ? blank(k) : (cells[i] ?? '')));
  const rebuilt = [
    row(remap(oldHeader, (k) => names[k])),
    row(names.map(() => '---')),
    ...sectionLines.slice(start + 2, end).map((line) => row(remap(splitRow(line), () => ''))),
  ];
  const added = names.filter((n) => !oldNames.includes(n));
  if (added.length > 0 && end > start + 2) {
    notes.push(
      `\`${table}\`: Example column${added.length > 1 ? 's' : ''} ${added.map((n) => `\`${n}\``).join(', ')} added with blank cells. Add sample values in the 3.0 markdown.`
    );
  }
  return [...sectionLines.slice(0, start), ...rebuilt, ...sectionLines.slice(end)];
}

/**
 * One `## table` section per DDL table, each with an Example table whose
 * header is the DDL column list. Sections of tables no longer in the DDL are
 * removed; a new table gets a stub section in its maturity group.
 */
export function updateMarkdown(md, tables, groups) {
  const notes = [];
  let lines = md.split('\n');

  // Existing sections: fix the Example, or drop the section. Bottom-up so
  // earlier line numbers stay valid.
  for (const section of sectionsOf(lines).reverse()) {
    if (GROUP_HEADING_NAMES.has(section.name)) continue;
    const body = lines.slice(section.start, section.end);
    const replacement = tables[section.name]
      ? fixExample(
          body,
          tables[section.name].columns.map((c) => c.name),
          section.name,
          notes
        )
      : [];
    lines.splice(section.start, section.end - section.start, ...replacement);
  }

  // New tables: a stub section, in name order inside the table's group.
  const present = new Set(sectionsOf(lines).map((s) => s.name));
  for (const name of Object.keys(tables)) {
    if (present.has(name)) continue;
    const groupKey = GROUP_KEYS.find((key) => groups[key].includes(name)) ?? NEW_TABLE_GROUP;
    const sections = sectionsOf(lines);
    const groupAt = sections.findIndex(
      (s) => s.name === GROUP_HEADING[groupKey].replace(/ /g, '_')
    );
    let at = lines.length;
    if (groupAt !== -1) {
      const after = sections.slice(groupAt + 1);
      const stop = after.find(
        (s) => GROUP_HEADING_NAMES.has(s.name) || s.name.localeCompare(name) > 0
      );
      if (stop) at = stop.start;
    }
    const names = tables[name].columns.map((c) => c.name);
    const stub = [
      `## ${name}`,
      '',
      '*Description pending.*',
      '',
      '**Example**:',
      '',
      row(names),
      row(names.map(() => '---')),
      '',
    ];
    if (at === lines.length && lines[lines.length - 1].trim() !== '') stub.unshift('');
    lines.splice(at, 0, ...stub);
    notes.push(
      `\`${name}\`: new section in the 3.0 markdown says "Description pending" and has an empty Example. Write the intro and sample rows.`
    );
  }
  return { text: lines.join('\n'), notes };
}

// ---------------------------------------------------------------------------
// src/pages/data-dictionary/change-log.astro
// ---------------------------------------------------------------------------

const escapeHtml = (text) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');

/** DDL description as change-log HTML: escaped, with markdown links kept as links. */
const descriptionHtml = (text) =>
  escapeHtml(text).replace(
    /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
    '<a href="$2" class="text-clif-burgundy hover:underline">$1</a>'
  );

const logRow = (first, cells, date) =>
  [
    '                <tr>',
    `                  <td class="px-4 py-3 text-sm font-mono">${first}</td>`,
    ...cells.map((cell) => `                  <td class="px-4 py-3 text-sm">${cell}</td>`),
    '                  <td class="px-4 py-3 text-sm"></td>',
    `                  <td class="px-4 py-3 text-sm text-gray-500">${date}</td>`,
    '                </tr>',
  ].join('\n');

/**
 * Add rows to one collapsible section of the 3.0 block (newest first), then
 * recount its rows into the header and stamp its "Last updated".
 */
function addLogRows(section, label, unit, rows, date) {
  const summary = new RegExp(`(${label} \\()(\\d+)( ${unit}[^)]*\\))([^\\n]*)`);
  const at = section.search(summary);
  if (at === -1) throw new Error(`change log: no "${label}" section in the 3.0 block`);
  const open = section.indexOf('<tbody', at);
  const openEnd = section.indexOf('>', open) + 1;
  const close = section.indexOf('</tbody>', openEnd);
  const body = `\n${rows.join('\n')}${section.slice(openEnd, close)}`;
  const count = (body.match(/<tr[\s>]/g) ?? []).length;
  const head = section
    .slice(0, openEnd)
    .replace(
      summary,
      (_, a, _n, c, rest) =>
        `${a}${count}${c}${rest.replace(/Last updated: [^<]*/, `Last updated: ${date}`)}`
    );
  return head + body + section.slice(close);
}

/**
 * Log column changes on beta tables (the 3.0 log covers beta tables only):
 * a new column is a New Fields row; a dropped column, a type change or a
 * dropped table is a Revisions row.
 */
export function updateChangeLog(astro, diff, betaTables, date) {
  const notes = [];
  const beta = (item) => betaTables.includes(item.table);
  const fields = diff.addedColumns.filter(beta);
  const revisions = [
    ...diff.removedColumns.filter(beta).map((c) => ({
      area: c.name,
      text: `Dropped <code>${c.name}</code> from <code>${c.table}</code>.`,
    })),
    ...diff.typeChanges.filter(beta).map((c) => ({
      area: c.name,
      text: `Changed the type of <code>${c.table}.${c.name}</code> from ${escapeHtml(c.from)} to ${escapeHtml(c.to)}.`,
    })),
    ...diff.removedTables
      .filter((table) => betaTables.includes(table))
      .map((table) => ({ area: table, text: `Removed the <code>${table}</code> table.` })),
  ];
  if (fields.length === 0 && revisions.length === 0) return { text: astro, notes };

  const start = astro.search(/<h2[^>]*>\s*Version 3\.0\b/);
  if (start === -1) throw new Error('change log: no "Version 3.0" heading');
  const end = astro.indexOf('</section>', start);
  let section = astro.slice(start, end);

  if (fields.length > 0) {
    const rows = fields.map((c) => logRow(c.name, [c.table, descriptionHtml(c.description)], date));
    section = addLogRows(section, 'New Fields', 'fields? added', rows, date);
    for (const c of fields) {
      notes.push(
        `\`${c.table}.${c.name}\`: New Fields row added to the change log with the DDL description. Add the issue link (and any rationale) in \`change-log.astro\`.`
      );
    }
  }
  if (revisions.length > 0) {
    const rows = revisions.map((r) => logRow(r.area, [r.text], date));
    section = addLogRows(section, 'Revisions', 'updates?', rows, date);
    for (const r of revisions)
      notes.push(
        `Change log Revisions row added: "${r.text.replace(/<[^>]+>/g, '')}" Add the issue link in \`change-log.astro\`.`
      );
  }
  section = section.replace(/\(Last updated: [^)]*\)/, `(Last updated: ${date})`);
  return { text: astro.slice(0, start) + section + astro.slice(end), notes };
}

// ---------------------------------------------------------------------------
// Notes that come from the diff itself
// ---------------------------------------------------------------------------

/** A table that lost and gained columns in one change may have had a rename. */
export function renameNotes(diff) {
  const notes = [];
  const gained = new Set(diff.addedColumns.map((c) => c.table));
  for (const table of new Set(diff.removedColumns.map((c) => c.table))) {
    if (!gained.has(table)) continue;
    const lost = diff.removedColumns.filter((c) => c.table === table).map((c) => `\`${c.name}\``);
    const got = diff.addedColumns.filter((c) => c.table === table).map((c) => `\`${c.name}\``);
    notes.push(
      `\`${table}\`: lost ${lost.join(', ')} and gained ${got.join(', ')}. If this was a rename, the old Example values were dropped (they are in git history) and the change log should say "Renamed".`
    );
  }
  return notes;
}
