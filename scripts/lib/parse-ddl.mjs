// Parse a CLIF DDL file. Same rules as the data dictionary pages
// (src/pages/data-dictionary/data-dictionary-<version>.astro), so a table or
// column counts here exactly when the site renders it.

/**
 * @typedef {{ name: string, type: string, description: string }} DdlColumn
 * @typedef {{ column: string, table: string }} DdlForeignKey
 * @typedef {{ columns: DdlColumn[], foreignKeys: DdlForeignKey[] }} DdlTable
 */

/**
 * @param {string} ddl
 * @returns {Record<string, DdlTable>} tables by name, in file order
 */
export function parseDdl(ddl) {
  /** @type {Record<string, DdlTable>} */
  const tables = {};
  const tableRegex = /CREATE TABLE ([a-zA-Z0-9_]+)\s*\(([^;]*?)\);/gis;
  const foreignKeyRegex = /FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s*([^,)]+)/gi;
  let match;
  while ((match = tableRegex.exec(ddl)) !== null) {
    const foreignKeys = [...match[2].matchAll(foreignKeyRegex)].map((fk) => ({
      column: fk[1].trim(),
      table: fk[2].trim().replace(/\(.*/, '').trim(),
    }));
    const body = match[2].replace(foreignKeyRegex, '');
    const columnRegex = /([a-zA-Z0-9_]+)\s+([A-Z]+(?:\([^)]*\))?)(?:\s+COMMENT\s+'([^']*)')?/g;
    const columns = [];
    let col;
    while ((col = columnRegex.exec(body)) !== null) {
      let description = col[3] ?? '';
      try {
        description = JSON.parse(description).description ?? description;
      } catch {
        // Not JSON: keep the raw comment text.
      }
      columns.push({ name: col[1], type: col[2], description });
    }
    if (columns.length > 0) tables[match[1]] = { columns, foreignKeys };
  }
  return tables;
}

/** Column type as the ERD shows it: lower case, no length. */
export const shortType = (type) => type.replace(/\(.*/, '').toLowerCase();
