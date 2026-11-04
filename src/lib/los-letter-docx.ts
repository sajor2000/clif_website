/**
 * Render a letter of collaboration as a Word document with the `docx`
 * package: letterhead in the page header (logo beside the consortium name),
 * the letter text, then a borderless two-column signature table where each
 * cell is the PI's name line over their signature image. Mirrors the layout
 * of the consortium's CLIF_LOC_template.docx (Times New Roman 11, 1" margins).
 */
import {
  AlignmentType,
  Document,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { SIGNATURE_BOX, fitImage, type LetterContent, type Signatory, signatoryLine } from './los-letter';
import { LETTERHEAD_LOGO_HEIGHT, LETTERHEAD_LOGO_WIDTH, letterheadLogoPng } from './los-letterhead-logo';

/** Logo width on the page, in points. */
const LOGO_WIDTH_PT = 120;
/** docx sizes images in CSS pixels (96 dpi), so 1pt = 4/3 px. */
const px = (pt: number) => Math.round((pt * 4) / 3);
/** Twips: 1pt = 20 twips. */
const twip = (pt: number) => Math.round(pt * 20);

const FONT = 'Times New Roman';
const BODY_SIZE = 22; // half-points → 11pt

export async function renderLetterDocx(content: LetterContent): Promise<Buffer> {
  const doc = new Document({
    creator: 'CLIF Consortium',
    title: content.re.replace(/^Re:\s*/, ''),
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: twip(612), height: twip(792) },
            margin: { top: twip(72), right: twip(72), bottom: twip(43.2), left: twip(72), header: twip(36), footer: twip(36) },
          },
        },
        headers: { default: new Header({ children: [letterhead(content.letterheadTitle)] }) },
        children: [
          text(content.date),
          text(content.re),
          text(content.salutation),
          ...content.paragraphs.map((p) => text(p)),
          text(content.closing),
          signatureTable(content.signatories),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function text(t: string): Paragraph {
  return new Paragraph({ children: [new TextRun(t)], spacing: { after: 220 } });
}

/** Logo in a narrow left cell, consortium name centered in the rest. */
function letterhead(title: string): Table {
  const logo = fitImage({ width: LETTERHEAD_LOGO_WIDTH, height: LETTERHEAD_LOGO_HEIGHT }, { width: LOGO_WIDTH_PT, height: 60 });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: twip(LOGO_WIDTH_PT + 8), type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    type: 'png',
                    data: letterheadLogoPng(),
                    transformation: { width: px(logo.width), height: px(logo.height) },
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: title, bold: true, size: 24 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function signatureTable(signatories: Signatory[]): Table {
  const rows: TableRow[] = [];
  for (let i = 0; i < signatories.length; i += 2) {
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [signatureCell(signatories[i]), signatureCell(signatories[i + 1])],
      }),
    );
  }
  if (rows.length === 0) {
    rows.push(new TableRow({ children: [signatureCell(undefined), signatureCell(undefined)] }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [twip(234), twip(234)],
    borders: TableBorders.NONE,
    rows,
  });
}

function signatureCell(s: Signatory | undefined): TableCell {
  const children: Paragraph[] = [];
  if (s) {
    children.push(new Paragraph({ children: [new TextRun(signatoryLine(s))], spacing: { after: 60 } }));
    if (s.signature) {
      const size = fitImage(s.signature, SIGNATURE_BOX);
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: s.signature.mime === 'image/png' ? 'png' : 'jpg',
              data: s.signature.data,
              transformation: { width: px(size.width), height: px(size.height) },
            }),
          ],
          spacing: { after: 160 },
        }),
      );
    } else {
      // No image on file: leave room to sign by hand.
      children.push(new Paragraph({ children: [], spacing: { before: twip(SIGNATURE_BOX.height - 12), after: 160 } }));
    }
  } else {
    children.push(new Paragraph({ children: [] }));
  }
  return new TableCell({ width: { size: twip(234), type: WidthType.DXA }, children });
}
