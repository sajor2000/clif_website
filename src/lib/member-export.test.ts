import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { availableFields, membersToCsv, membersToXlsx, resolveFields } from './member-export';

const members = [
  {
    id: 'u1',
    full_name: 'Ada "Lovelace"',
    email: 'ada@gmail.com',
    work_email: 'ada@uni.edu',
    institution: 'Uni, Dept',
    role: 'admin',
    funding: '=HYPERLINK("x")',
    gmail_personal: 'ada.p@gmail.com',
    affiliation: 'Line 1\nLine 2 & <more> 🧪',
  },
  { id: 'u2', full_name: 'Bob', email: 'bob@x.org', work_email: null, role: 'member' },
];

describe('field access', () => {
  it('hides private fields from non-admins', () => {
    expect(availableFields(false).some((f) => f.private)).toBe(false);
    expect(availableFields(true).map((f) => f.key)).toContain('gmail_personal');
  });

  it('ignores private fields a non-admin asks for', () => {
    expect(resolveFields(['full_name', 'gmail_personal'], false).map((f) => f.key)).toEqual(['full_name']);
  });

  it('falls back to every allowed field when none are valid', () => {
    expect(resolveFields([], false)).toEqual(availableFields(false));
    expect(resolveFields(['bogus'], true)).toEqual(availableFields(true));
  });
});

describe('membersToCsv', () => {
  const fields = resolveFields(['full_name', 'email', 'institution', 'role', 'funding'], false);
  const csv = membersToCsv(members, fields);

  it('writes a BOM, header, and quoted/escaped cells', () => {
    const lines = csv.slice(1).split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('Name,Email,Institution,Role,Funding');
    expect(lines[1]).toBe(`"Ada ""Lovelace""",ada@uni.edu,"Uni, Dept",steering,"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toBe('Bob,bob@x.org,,member,');
  });
});

describe('membersToXlsx', () => {
  it('produces a readable workbook with escaped inline strings', () => {
    const files = unzipSync(membersToXlsx(members, resolveFields(['full_name', 'affiliation'], true)));
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']),
    );
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Name</t>');
    expect(sheet).toContain('Line 1\nLine 2 &amp; &lt;more&gt; 🧪');
    expect(sheet).toContain('<c r="B3"');
  });
});
