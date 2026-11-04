import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import {
  buildLetterContent,
  fitImage,
  formatLetterDate,
  lastName,
  letterFileName,
  letterParagraph,
  letterParagraphs,
  letterSubject,
  signatoryLine,
  sortSignatories,
  type Signatory,
} from './los-letter';
import { renderLetterDocx } from './los-letter-docx';
import { ansi, renderLetterPdf } from './los-letter-pdf';
import { sniffImage } from './image-dimensions';

const request = {
  grant_title: 'Early mobilization in mechanically ventilated patients',
  grant_type: 'R01',
  applicant_pi: 'Jane Doe, MD',
  applicant_institution: 'the University of Chicago',
  funding_agency: 'NIH',
  extra_paragraph: null,
};

// 1x1 transparent PNG.
const PNG_1x1 = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
);

// 1x1 red PNG — distinct bytes, since docx de-duplicates identical images.
const PNG_RED = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'),
);

const pi = (user_id: string, full_name: string, institution: string, withSignature = true): Signatory => ({
  user_id,
  full_name,
  degrees: 'MD',
  institution,
  signature: withSignature
    ? { mime: 'image/png', data: Number(user_id) % 2 ? PNG_RED : PNG_1x1, width: 300, height: 100 }
    : null,
});

describe('letter text', () => {
  it('fills the template paragraph blanks', () => {
    expect(letterParagraph(request)).toBe(
      'We are the steering committee leadership of the CLIF consortium. If the application submitted by the University of Chicago with Jane Doe, MD, as the Principal Investigator, entitled “Early mobilization in mechanically ventilated patients,” is selected for funding by NIH, it is our intent to collaborate, provide data, and perform analyses as detailed in the application.',
    );
  });

  it('defaults the agency to NIH and marks missing blanks', () => {
    const p = letterParagraph({ grant_title: 'T', applicant_pi: '', applicant_institution: null, funding_agency: '  ' });
    expect(p).toContain('submitted by [institution] with [PI],');
    expect(p).toContain('funding by NIH,');
  });

  it('appends extra paragraphs split on blank lines', () => {
    const ps = letterParagraphs({ ...request, extra_paragraph: 'First extra\nline.\n\n\nSecond extra.\n' });
    expect(ps).toHaveLength(3);
    expect(ps[1]).toBe('First extra line.');
    expect(ps[2]).toBe('Second extra.');
  });

  it('builds the Re: line from grant type and title', () => {
    expect(letterSubject(request)).toBe('Re: R01 – Early mobilization in mechanically ventilated patients');
    expect(letterSubject({ grant_title: 'T', grant_type: null })).toBe('Re: T');
  });

  it('formats the date as a long US date in Chicago time', () => {
    expect(formatLetterDate(new Date('2026-11-04T15:00:00Z'))).toBe('November 4, 2026');
    // 03:00 UTC on the 5th is still the 4th in Chicago.
    expect(formatLetterDate(new Date('2026-11-05T03:00:00Z'))).toBe('November 4, 2026');
  });
});

describe('signatories', () => {
  it('prints name, degrees and institution', () => {
    expect(signatoryLine({ full_name: 'Siva Bhavani', degrees: 'MD, MS', institution: 'Emory University' })).toBe(
      'Siva Bhavani, MD, MS – Emory University',
    );
    expect(signatoryLine({ full_name: 'A B', degrees: '', institution: null })).toBe('A B');
  });

  it('finds the last name past middle initials, hyphens and suffixes', () => {
    expect(lastName('Juan C. Rojas')).toBe('rojas');
    expect(lastName('Vikram Field-Singh')).toBe('field-singh');
    expect(lastName('William F. Parker Jr.')).toBe('parker');
    expect(lastName('Catherine Gao, MD')).toBe('gao');
    expect(lastName('')).toBe('');
  });

  it('sorts alphabetically by last name', () => {
    const sorted = sortSignatories([
      pi('1', 'William F. Parker', 'Chicago'),
      pi('2', 'Anna Barker', 'Michigan'),
      pi('3', 'Andre Amaral', 'Toronto'),
      pi('4', 'Juan C. Rojas', 'Rush'),
    ]).map((s) => s.full_name);
    expect(sorted).toEqual(['Andre Amaral', 'Anna Barker', 'William F. Parker', 'Juan C. Rojas']);
  });

  it('fits images into the box without enlarging', () => {
    expect(fitImage({ width: 600, height: 200 }, { width: 190, height: 60 })).toEqual({ width: 180, height: 60 });
    expect(fitImage({ width: 1000, height: 100 }, { width: 190, height: 60 })).toEqual({ width: 190, height: 19 });
  });

  it('names the file from the title and date', () => {
    expect(letterFileName(request, 'pdf', new Date('2026-11-04T15:00:00Z'))).toBe(
      'CLIF_LOC_Early_mobilization_in_mechanically_ventilated_patients_2026-11-04.pdf',
    );
  });
});

describe('renderers', () => {
  const content = buildLetterContent(
    request,
    [pi('1', 'William F. Parker', 'University of Chicago'), pi('2', 'Anna Barker', 'University of Michigan', false), pi('4', 'Andre Amaral', 'University of Toronto')],
    new Date('2026-11-04T15:00:00Z'),
  );

  it('writes a .docx whose document part carries the letter text and signatories', async () => {
    const buf = await renderLetterDocx(content);
    const parts = unzipSync(new Uint8Array(buf));
    const doc = strFromU8(parts['word/document.xml']);
    expect(doc).toContain('November 4, 2026');
    expect(doc).toContain('Dear Review Committee Members:');
    expect(doc).toContain('entitled “Early mobilization');
    expect(doc).toContain('Anna Barker, MD – University of Michigan');
    // Alphabetical by last name: Amaral before Barker before Parker.
    expect(doc.indexOf('Andre Amaral')).toBeLessThan(doc.indexOf('Anna Barker'));
    expect(doc.indexOf('Anna Barker')).toBeLessThan(doc.indexOf('William F. Parker'));
    // Two signature images embedded (Barker has none) plus the logo.
    expect(Object.keys(parts).filter((k) => k.startsWith('word/media/'))).toHaveLength(3);
    expect(strFromU8(parts['word/header1.xml'])).toContain('Common Longitudinal ICU data Format (CLIF) Consortium');
  });

  it('writes a one-page PDF for a short letter', async () => {
    const bytes = await renderLetterPdf(content);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe('R01 – Early mobilization in mechanically ventilated patients');
  });

  it('paginates a long signature block', async () => {
    const many = Array.from({ length: 30 }, (_, i) => pi(String(i), `Pi Number${String(i).padStart(2, '0')}`, 'Site'));
    const bytes = await renderLetterPdf(buildLetterContent(request, many));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it('replaces glyphs outside WinAnsi before drawing', () => {
    expect(ansi('café “quoted” – 中')).toBe('café “quoted” – ?');
  });
});

describe('sniffImage', () => {
  it('reads PNG dimensions from IHDR', () => {
    expect(sniffImage(PNG_1x1)).toEqual({ mime: 'image/png', width: 1, height: 1 });
  });

  it('reads JPEG dimensions from the SOF0 segment', () => {
    const jpeg = Uint8Array.from([
      0xff, 0xd8, // SOI
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0, length 4
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x01, 0x2c, 0x02, 0x58, 0x01, 0x01, 0x11, 0x00, // SOF0: 8-bit, 300 high, 600 wide
    ]);
    expect(sniffImage(jpeg)).toEqual({ mime: 'image/jpeg', width: 600, height: 300 });
  });

  it('rejects anything else', () => {
    expect(sniffImage(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(sniffImage(new Uint8Array(0))).toBeNull();
  });
});
