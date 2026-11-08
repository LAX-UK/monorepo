import { readFileSync } from "node:fs";
import { finished } from "node:stream/promises";
import { legalEntityFor, productCopyrightLine } from "@auction/branding";
import PDFDocument from "pdfkit";

/** One line of an invoice as it was raised, in whole pence. */
export type BidInvoiceDocumentLine = {
  label: string;
  /** The rate the amount was worked out at ("25"), or `null` when it is not a rate. */
  ratePercent: string | null;
  amountPence: number;
};

/** What the Bid invoice says, from the stored invoice record. Nothing here is recomputed. */
export type BidInvoiceDocument = {
  /** Our invoice number, when one has been assigned. */
  number: string | null;
  raisedAt: Date;
  dueAt: Date;
  /** The account billed: its name as the account holds it. */
  billedTo: string;
  lot: { title: string; lotNumber: number | null; saleTitle: string | null };
  lines: readonly BidInvoiceDocumentLine[];
  totalPence: number;
  /**
   * `paid` once the payment has been received and `refunded` once it was given back; the invoice
   * is otherwise awaiting payment.
   */
  status: "awaiting_payment" | "paid" | "refunded";
  /**
   * What has been given back so far, in whole pence, from the refund records (cumulative). A part
   * refund leaves the payment paid, so this is what tells it apart; it is `0` when none is on
   * record. The charge lines always stay as invoiced: a credit note, not this document, is the
   * formal instrument that reverses charges.
   */
  refundedPence: number;
};

/** The invoice's lines do not add up to its total: it is not issued rather than shown wrongly. */
export class InvoiceTotalMismatchError extends Error {
  constructor(sumPence: number, totalPence: number) {
    super(`Invoice lines add up to ${sumPence} pence, not the invoice total of ${totalPence}`);
    this.name = "InvoiceTotalMismatchError";
  }
}

/**
 * Noto Sans (SIL Open Font License) is embedded so names print in Latin, Latin Extended, Greek
 * and Cyrillic scripts as well as the standard PDF fonts would; the PDF base fonts cover only
 * Western European text. Scripts outside those (for example Arabic or CJK) are not in the font.
 */
const FONT_FILES = {
  regular: "NotoSans_400Regular.ttf",
  bold: "NotoSans_700Bold.ttf",
} as const;

let fontBuffers: { regular: Buffer; bold: Buffer } | null = null;

function invoiceFonts(): { regular: Buffer; bold: Buffer } {
  fontBuffers ??= {
    regular: readFileSync(new URL(`../../fonts/${FONT_FILES.regular}`, import.meta.url)),
    bold: readFileSync(new URL(`../../fonts/${FONT_FILES.bold}`, import.meta.url)),
  };
  return fontBuffers;
}

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

/** "Fri 13 Nov 2026": the London day, in the one date style, with the year an invoice needs. */
function dayLabel(date: Date): string {
  return DAY.format(date).replace(",", "");
}

/** "£1,234.50" from whole pence. */
export function invoiceMoney(pence: number): string {
  return GBP.format(pence / 100);
}

/** How the payment stands once refunds on record are taken into account. */
type Standing = "awaiting_payment" | "paid" | "part_refunded" | "refunded";

const STATUS_WORDS: Record<Standing, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  part_refunded: "Part refunded",
  refunded: "Refunded",
};

const TOTAL_WORDS: Record<Standing, string> = {
  awaiting_payment: "Total to pay",
  paid: "Total paid",
  part_refunded: "Total paid",
  refunded: "Invoice total",
};

/**
 * A payment that was paid and then partly refunded stays paid in the records, so the refund
 * records decide: some given back is a part refund, all of it is a refund. A refund with no
 * amount on record is shown as refunded without inventing a figure.
 */
function standingOf(input: BidInvoiceDocument, refundedPence: number): Standing {
  if (input.status === "awaiting_payment") return "awaiting_payment";
  if (input.status === "refunded" || refundedPence >= input.totalPence) return "refunded";
  return refundedPence > 0 ? "part_refunded" : "paid";
}

/** What the document says, in order, as plain text rows: the part under test. */
export type BidInvoiceView = {
  issuer: { name: string; address: string; registration: string[] };
  title: string;
  facts: [label: string, value: string][];
  lines: [label: string, amount: string][];
  total: [label: string, amount: string];
  /** What was given back and what is left paid, after the total; empty when nothing was. */
  refunds: [label: string, amount: string][];
  footer: string[];
};

/**
 * The invoice as rows of words. The lines must add up to the total exactly (whole pence); if they
 * do not, nothing is issued. The issuer is London Auction Xchange LTD, with its company and VAT
 * numbers only once they are confirmed.
 */
export function bidInvoiceView(input: BidInvoiceDocument): BidInvoiceView {
  const sum = input.lines.reduce((total, line) => total + line.amountPence, 0);
  if (sum !== input.totalPence) throw new InvoiceTotalMismatchError(sum, input.totalPence);

  const issuer = legalEntityFor("bid");
  const lotRef = [
    input.lot.lotNumber === null ? null : `Lot ${input.lot.lotNumber}`,
    input.lot.saleTitle,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  const refundedPence = Math.min(Math.max(0, input.refundedPence), input.totalPence);
  const standing = standingOf(input, refundedPence);
  const settled = standing !== "awaiting_payment";
  return {
    issuer: {
      name: issuer.name,
      address: issuer.registeredAddress.inline,
      registration: [
        issuer.companyNumber ? `Company number ${issuer.companyNumber}` : null,
        issuer.vatNumber ? `VAT number ${issuer.vatNumber}` : null,
      ].filter((part): part is string => part !== null),
    },
    title: input.number ? `Invoice ${input.number}` : "Invoice",
    facts: [
      ["Billed to", input.billedTo],
      ["Work", input.lot.title],
      ...(lotRef ? ([["Lot", lotRef]] as [string, string][]) : []),
      ["Raised", dayLabel(input.raisedAt)],
      [settled ? "Was due" : "Due by", dayLabel(input.dueAt)],
      ["Status", STATUS_WORDS[standing]],
    ],
    lines: input.lines.map((line) => [line.label, invoiceMoney(line.amountPence)]),
    total: [TOTAL_WORDS[standing], invoiceMoney(input.totalPence)],
    refunds:
      refundedPence > 0
        ? [
            ["Refunded", invoiceMoney(refundedPence)],
            ["Net paid", invoiceMoney(input.totalPence - refundedPence)],
          ]
        : [],
    footer: [`Invoice from ${issuer.name}, ${issuer.registeredAddress.inline}`],
  };
}

/**
 * The Bid invoice as a PDF the payer keeps. It is rendered from the stored invoice each time, so
 * it always matches the record, and uses the invoice's own lines in the invoice's own order.
 */
export async function renderBidInvoicePdf(input: BidInvoiceDocument): Promise<Buffer> {
  const view = bidInvoiceView(input);
  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    info: { Title: view.title, Author: view.issuer.name },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const fonts = invoiceFonts();
  doc.registerFont("Body", fonts.regular);
  doc.registerFont("Body-Bold", fonts.bold);

  doc.font("Body-Bold").fontSize(18).text("LAX Bid");
  doc.font("Body").fontSize(9).fillColor("#555555");
  doc.text(`${view.issuer.name}, ${view.issuer.address}`);
  if (view.issuer.registration.length > 0) doc.text(view.issuer.registration.join(" · "));
  doc.moveDown(1.2);
  doc.font("Body-Bold").fontSize(14).fillColor("#111111").text(view.title);
  doc.moveDown(0.8);

  doc.fontSize(10);
  for (const [label, value] of view.facts) {
    const y = doc.y;
    doc.font("Body").fillColor("#555555").text(label, 50, y, { width: 130 });
    doc.font("Body").fillColor("#111111").text(value, 190, y, { width: 355 });
    doc.moveDown(0.4);
  }

  doc.moveDown(0.8);
  doc.font("Body-Bold").fontSize(11).fillColor("#111111").text("Charges", 50);
  doc.moveDown(0.3);
  doc.font("Body").fontSize(10);
  for (const [label, amount] of view.lines) {
    const y = doc.y;
    doc.text(label, 50, y, { width: 360 });
    doc.text(amount, 420, y, { width: 125, align: "right" });
    doc.moveDown(0.3);
  }
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.4);
  const y = doc.y;
  doc.font("Body-Bold").text(view.total[0], 50, y, { width: 360 });
  doc.text(view.total[1], 420, y, { width: 125, align: "right" });
  for (const [index, [label, amount]] of view.refunds.entries()) {
    doc.moveDown(0.4);
    const rowY = doc.y;
    doc.font(index === view.refunds.length - 1 ? "Body-Bold" : "Body");
    doc.text(label, 50, rowY, { width: 360 });
    doc.text(amount, 420, rowY, { width: 125, align: "right" });
  }

  doc.moveDown(3);
  doc.font("Body").fontSize(8).fillColor("#555555");
  for (const line of view.footer) doc.text(line, 50);
  doc.text(productCopyrightLine("bid"));
  doc.end();
  await finished(doc);
  return Buffer.concat(chunks);
}
