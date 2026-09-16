import { strToU8, zipSync } from 'fflate';

type Row = Record<string, unknown>;

export interface MemberExportField {
  key: string;
  label: string;
  /** Only admins may export private fields (mirrors the profile page's canSeePrivate). */
  private?: boolean;
  value: (m: Row) => unknown;
}

export const MEMBER_EXPORT_FIELDS: MemberExportField[] = [
  { key: 'full_name', label: 'Name', value: (m) => m.full_name },
  { key: 'degrees', label: 'Degrees', value: (m) => m.degrees },
  { key: 'email', label: 'Email', value: (m) => m.work_email || m.email },
  { key: 'institution', label: 'Institution', value: (m) => m.institution },
  { key: 'affiliation', label: 'Affiliation', value: (m) => m.affiliation },
  {
    key: 'role',
    label: 'Role',
    value: (m) => (m.role === 'steering' || m.role === 'admin' ? 'steering' : 'member'),
  },
  { key: 'member_status', label: 'Member status', value: (m) => m.member_status },
  { key: 'orcid', label: 'ORCID', value: (m) => m.orcid },
  { key: 'github_username', label: 'GitHub', value: (m) => m.github_username },
  { key: 'funding', label: 'Funding', value: (m) => m.funding },
  { key: 'conflicts_of_interest', label: 'Conflicts of interest', value: (m) => m.conflicts_of_interest },
  { key: 'signup_email', label: 'Sign-up email', private: true, value: (m) => m.email },
  { key: 'gmail_personal', label: 'Personal Gmail', private: true, value: (m) => m.gmail_personal },
];

export function availableFields(isAdmin: boolean): MemberExportField[] {
  return MEMBER_EXPORT_FIELDS.filter((f) => isAdmin || !f.private);
}

/** Resolve requested keys against the fields the caller may see; empty/unknown → all allowed. */
export function resolveFields(requested: string[], isAdmin: boolean): MemberExportField[] {
  const allowed = availableFields(isAdmin);
  const wanted = new Set(requested);
  const picked = allowed.filter((f) => wanted.has(f.key));
  return picked.length > 0 ? picked : allowed;
}

function toText(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

export function membersToCsv(members: Row[], fields: MemberExportField[]): string {
  const cell = (raw: string) => {
    // Neutralize spreadsheet formula injection from user-entered text.
    const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [fields.map((f) => cell(f.label)).join(',')];
  for (const m of members) lines.push(fields.map((f) => cell(toText(f.value(m)))).join(','));
  // BOM so Excel opens the file as UTF-8.
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function xmlEscape(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex -- stripping chars XML 1.0 forbids
    .replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Build a minimal single-sheet .xlsx (inline strings, bold frozen header). */
export function membersToXlsx(members: Row[], fields: MemberExportField[]): Uint8Array {
  const rowXml = (values: string[], r: number, style: number) =>
    `<row r="${r}">` +
    values
      .map(
        (v, c) =>
          `<c r="${columnName(c)}${r}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`,
      )
      .join('') +
    '</row>';

  const rows = [rowXml(fields.map((f) => f.label), 1, 1)];
  members.forEach((m, i) => rows.push(rowXml(fields.map((f) => toText(f.value(m))), i + 2, 0)));

  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${fields.map((_, c) => `<col min="${c + 1}" max="${c + 1}" width="28" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${rows.join('')}</sheetData>` +
    '</worksheet>';

  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="Members" sheetId="1" r:id="rId1"/></sheets>' +
      '</workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>',
    'xl/styles.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>',
    'xl/worksheets/sheet1.xml': sheet,
  };

  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
}
