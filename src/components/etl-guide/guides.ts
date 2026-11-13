// Per-table ETL guides, shared by the standalone ETL guide pages and the
// data dictionary pop-ups. One partial per table at
// `./<version>/<table-slug>.astro`, where the slug is the data dictionary
// section id for that table. Adding a file there is all it takes for the
// table to get an "ETL Guide" button in that version's data dictionary.
type AstroComponent = (props: Record<string, unknown>) => unknown;

const modules = import.meta.glob<{ default: AstroComponent }>('./*/*.astro', { eager: true });

export function tableSlug(tableName: string): string {
  return tableName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function getEtlGuide(version: string, tableName: string): AstroComponent | undefined {
  return modules[`./${version}/${tableSlug(tableName)}.astro`]?.default;
}
