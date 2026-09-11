import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLIF_TABLES, PROJECT_RUN_VERSIONS, runnableTableGroups, runnableTables } from './clif-tables';

const DDL_FILES: Record<string, string> = {
  '2.1': 'src/content/v-2-1-0-ddl.sql',
  '3.0': 'src/content/v-3-0-0-ddl.sql',
};

function ddlTableNames(version: string): Set<string> {
  const ddl = readFileSync(DDL_FILES[version], 'utf8');
  return new Set([...ddl.matchAll(/CREATE TABLE ([a-zA-Z0-9_]+)/gi)].map((m) => m[1]));
}

describe('CLIF_TABLES', () => {
  it('covers every version a project run can target', () => {
    for (const v of PROJECT_RUN_VERSIONS) expect(CLIF_TABLES[v]).toBeDefined();
  });

  it('does not offer 2.0 for project runs', () => {
    expect(PROJECT_RUN_VERSIONS).not.toContain('2.0');
  });

  it('puts each table in only one maturity group per version', () => {
    for (const [v, t] of Object.entries(CLIF_TABLES)) {
      const all = [...t.beta, ...t.alpha, ...t.concept, ...t.futureProposed];
      expect(new Set(all).size, `duplicate table in CLIF ${v}`).toBe(all.length);
    }
  });

  it('only offers runnable tables that are defined in that version\'s DDL', () => {
    for (const v of PROJECT_RUN_VERSIONS) {
      const ddl = ddlTableNames(v);
      const missing = runnableTables(v).filter((t) => !ddl.has(t));
      expect(missing, `CLIF ${v} tables missing from ${DDL_FILES[v]}`).toEqual([]);
    }
  });
});

describe('runnableTableGroups', () => {
  it('offers Beta, Alpha and Concept tables, skipping empty groups', () => {
    expect(runnableTableGroups('2.1').map((g) => g.label)).toEqual(['Beta', 'Concept']);
    expect(runnableTableGroups('3.0').map((g) => g.label)).toEqual(['Beta', 'Alpha', 'Concept']);
    const t = CLIF_TABLES['3.0'];
    expect(runnableTables('3.0')).toHaveLength(t.beta.length + t.alpha.length + t.concept.length);
  });

  it('leaves out future-proposed tables', () => {
    expect(runnableTables('3.0')).not.toContain('validated_diagnosis');
  });

  it('returns nothing for an unknown version', () => {
    expect(runnableTables('2.0')).toEqual([]);
  });
});
