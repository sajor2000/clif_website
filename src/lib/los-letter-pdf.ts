/**
 * Render a letter of collaboration as a PDF with pdf-lib, laid out to match
 * the .docx renderer: letterhead on every page, the letter text in Times
 * Roman 11, and a two-column signature block of name lines over signature
 * images. Text is wrapped and paginated by hand; the standard Times fonts
 * only cover WinAnsi, so other characters are replaced before drawing.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { SIGNATURE_BOX, fitImage, type LetterContent, type Signatory, signatoryLine } from './los-letter';
import { LETTERHEAD_LOGO_HEIGHT, LETTERHEAD_LOGO_WIDTH, letterheadLogoPng } from './los-letterhead-logo';

const PAGE = { width: 612, height: 792 };
const MARGIN = { top: 72, right: 72, bottom: 43.2, left: 72, header: 36 };
const BODY_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
const FONT_SIZE = 11;
const LINE = FONT_SIZE * 1.2;
const PARAGRAPH_GAP = 11;
const LOGO_WIDTH_PT = 120;
const COLUMN_WIDTH = BODY_WIDTH / 2;
const CELL_PAD = 4;
const BLACK = rgb(0, 0, 0);

export async function renderLetterPdf(content: LetterContent): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(content.re.replace(/^Re:\s*/, ''));
  pdf.setAuthor('CLIF Consortium');
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const logo = await pdf.embedPng(letterheadLogoPng());

  const w = new Writer(pdf, font, bold, logo, content.letterheadTitle);
  w.newPage();

  for (const line of [content.date, content.re, content.salutation]) w.paragraph(line);
  for (const p of content.paragraphs) w.paragraph(p);
  w.paragraph(content.closing);

  const images = new Map<string, PDFImage>();
  for (const s of content.signatories) {
    if (!s.signature) continue;
    images.set(
      s.user_id,
      s.signature.mime === 'image/png' ? await pdf.embedPng(s.signature.data) : await pdf.embedJpg(s.signature.data),
    );
  }
  for (let i = 0; i < content.signatories.length; i += 2) {
    w.signatureRow([content.signatories[i], content.signatories[i + 1]], images);
  }

  return pdf.save();
}

class Writer {
  page!: PDFPage;
  y = 0;

  constructor(
    private pdf: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
    private logo: PDFImage,
    private title: string,
  ) {}

  newPage(): void {
    this.page = this.pdf.addPage([PAGE.width, PAGE.height]);
    const size = fitImage({ width: LETTERHEAD_LOGO_WIDTH, height: LETTERHEAD_LOGO_HEIGHT }, { width: LOGO_WIDTH_PT, height: 60 });
    const logoTop = PAGE.height - MARGIN.header;
    this.page.drawImage(this.logo, { x: MARGIN.left, y: logoTop - size.height, width: size.width, height: size.height });
    const title = ansi(this.title);
    const titleSize = 12;
    const titleWidth = this.bold.widthOfTextAtSize(title, titleSize);
    const areaLeft = MARGIN.left + LOGO_WIDTH_PT + 8;
    const areaWidth = PAGE.width - MARGIN.right - areaLeft;
    this.page.drawText(title, {
      x: areaLeft + Math.max(0, (areaWidth - titleWidth) / 2),
      y: logoTop - size.height / 2 - titleSize * 0.35,
      size: titleSize,
      font: this.bold,
      color: BLACK,
    });
    this.y = logoTop - size.height - 28;
  }

  private ensure(height: number): void {
    if (this.y - height < MARGIN.bottom) this.newPage();
  }

  paragraph(text: string): void {
    const lines = wrap(ansi(text), this.font, FONT_SIZE, BODY_WIDTH);
    for (const line of lines) {
      this.ensure(LINE);
      this.page.drawText(line, { x: MARGIN.left, y: this.y - FONT_SIZE, size: FONT_SIZE, font: this.font, color: BLACK });
      this.y -= LINE;
    }
    this.y -= PARAGRAPH_GAP;
  }

  /** One row of the signature block: up to two cells, kept together on a page. */
  signatureRow(cells: Array<Signatory | undefined>, images: Map<string, PDFImage>): void {
    const laid = cells.map((s) => {
      if (!s) return null;
      const lines = wrap(ansi(signatoryLine(s)), this.font, FONT_SIZE, COLUMN_WIDTH - 2 * CELL_PAD);
      const img = s.signature ? fitImage(s.signature, SIGNATURE_BOX) : null;
      const height = lines.length * LINE + CELL_PAD + (img ? img.height : SIGNATURE_BOX.height - 12) + 12;
      return { s, lines, img, height };
    });
    const rowHeight = Math.max(...laid.map((c) => c?.height ?? 0));
    this.ensure(rowHeight);
    laid.forEach((cell, col) => {
      if (!cell) return;
      const x = MARGIN.left + col * COLUMN_WIDTH + CELL_PAD;
      let y = this.y;
      for (const line of cell.lines) {
        this.page.drawText(line, { x, y: y - FONT_SIZE, size: FONT_SIZE, font: this.font, color: BLACK });
        y -= LINE;
      }
      y -= CELL_PAD;
      const image = images.get(cell.s.user_id);
      if (image && cell.img) {
        this.page.drawImage(image, { x, y: y - cell.img.height, width: cell.img.width, height: cell.img.height });
      }
    });
    this.y -= rowHeight;
  }
}

/** Greedy word wrap; a single word longer than the line is split by character. */
export function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = '';
    let chunk = '';
    for (const ch of word) {
      if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = '';
      }
      chunk += ch;
    }
    current = chunk;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/**
 * The standard Times fonts encode WinAnsi (cp1252) only. Keep Latin-1 plus
 * the cp1252 extras (curly quotes, dashes, ellipsis, euro…) and replace the
 * rest with '?' rather than letting pdf-lib throw on an unencodable glyph.
 */
export function ansi(text: string): string {
  return text
    .normalize('NFC')
    .replace(/ /g, ' ')
    .replace(
      /[^\u0000-ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]/g,
      '?',
    );
}
