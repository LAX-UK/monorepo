import { finished } from "node:stream/promises";
import { legalEntityFor, productCopyrightLine } from "@auction/branding";
import { formatDate, runtimeTimeZone } from "@auction/datetime";
import { formatPayoutReference } from "@auction/domain";
import PDFDocument from "pdfkit";
import type { WorkerEnv } from "../env.js";
import type {
  PayoutStatementEntityRow,
  PayoutStatementLineRow,
  PayoutStatementPayoutRow,
} from "../interfaces/payout-statement.repository.js";
import { type StatementRow, payoutStatementDocument } from "./payout-statement.document.js";

export type PayoutStatementRenderInput = {
  payout: PayoutStatementPayoutRow;
  entity: PayoutStatementEntityRow;
  lines: PayoutStatementLineRow[];
  authorNames: Map<string, string>;
  env: WorkerEnv;
};

function moneyFmt(amount: string, currency: string): string {
  const n = Number.parseFloat(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);
}

function formatPeriod(start: Date, end: Date): string {
  const fmt = (d: Date) => formatDate(d, runtimeTimeZone(), { month: "short", engineSept: true });
  return `${fmt(start)} — ${fmt(end)}`;
}

/** The table's columns, left to right, across the page's 495pt between the margins. */
const COLUMNS: readonly { key: keyof StatementRow; label: string; width: number }[] = [
  { key: "work", label: "Work", width: 150 },
  { key: "lot", label: "Lot", width: 40 },
  { key: "hammer", label: "Hammer", width: 65 },
  { key: "commission", label: "Commission", width: 85 },
  { key: "vat", label: "VAT on commission", width: 75 },
  { key: "receive", label: "You receive", width: 80 },
];
const LEFT = 50;

function tableRow(
  doc: PDFKit.PDFDocument,
  cells: Record<keyof StatementRow, string>,
  font: "Helvetica" | "Helvetica-Bold",
): void {
  const y = doc.y;
  let x = LEFT;
  let bottom = y;
  doc.font(font);
  for (const [index, column] of COLUMNS.entries()) {
    doc.text(cells[column.key], x, y, {
      width: column.width - 6,
      align: index < 2 ? "left" : "right",
    });
    bottom = Math.max(bottom, doc.y);
    x += column.width;
  }
  doc.x = LEFT;
  doc.y = bottom + 4;
}

export async function renderPayoutStatementPdf(input: PayoutStatementRenderInput): Promise<Buffer> {
  const { payout: pRow, entity: entityRow, lines, authorNames, env } = input;
  const payoutId = pRow.id;

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const entityDisplayName =
    entityRow.legalName?.trim() || entityRow.displayName?.trim() || entityRow.id.slice(0, 8);

  const issuer = legalEntityFor("bid");
  doc.fontSize(18).text("LAX Bid", { continued: false });
  doc.fontSize(9).text(`${issuer.name}, ${issuer.registeredAddress.inline}`);
  doc.moveDown(0.5);
  doc.fontSize(14).text("Payout statement", { underline: true });
  doc.moveDown();
  doc.fontSize(10);
  doc.text(`Statement period: ${formatPeriod(pRow.periodStart, pRow.periodEnd)}`);
  doc.text(`Entity: ${entityDisplayName}`);
  if (entityRow.vatNumber) {
    doc.text(`VAT number: ${entityRow.vatNumber}`);
  }
  doc.text(`Payout reference: ${formatPayoutReference(pRow)}`);
  doc.moveDown();

  const currency = pRow.currency;
  const statement = payoutStatementDocument({ payout: pRow, lines, now: new Date() });

  doc.fontSize(11).font("Helvetica").text("In this payout", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(8).fillColor("#555555");
  tableRow(
    doc,
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.label])) as Record<keyof StatementRow, string>,
    "Helvetica",
  );
  doc.fillColor("#000000");
  for (const row of statement.rows) tableRow(doc, row, "Helvetica");
  doc
    .moveTo(LEFT, doc.y)
    .lineTo(LEFT + 495, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.3);
  tableRow(doc, statement.totals, "Helvetica-Bold");
  doc.font("Helvetica");

  doc.moveDown();
  doc.fontSize(9).fillColor("#444444");
  for (const note of statement.notes) {
    doc.text(note, LEFT, doc.y, { width: 495 });
    doc.moveDown(0.3);
  }
  doc.fillColor("#000000");

  doc.moveDown();
  doc.fontSize(10);
  doc.text(`Payout amount: ${moneyFmt(pRow.netAmount, currency)}`);
  doc.text(`Currency: ${currency}`);

  doc.addPage();
  doc.fontSize(12).text("Administrator appendix", { underline: true });
  doc.moveDown();
  doc.fontSize(10);
  doc.text(`Payout id: ${payoutId}`);
  doc.text(`Xero bill id: ${pRow.xeroBillId ?? "—"}`);
  doc.text(`Stripe transfer id: ${pRow.stripeTransferId ?? "—"}`);
  doc.moveDown();
  const adjustments = lines.filter((l) => l.kind === "adjustment");
  if (adjustments.length === 0) {
    doc.text("No adjustment lines.");
  } else {
    doc.text("Adjustments:");
    for (const a of adjustments) {
      const author =
        a.createdByUserId != null ? (authorNames.get(a.createdByUserId) ?? a.createdByUserId) : "—";
      doc.text(
        `• ${moneyFmt(String(a.amount), currency)} — note: ${a.note ?? "—"} — author: ${author}`,
      );
    }
  }

  doc.moveDown(2);
  doc.fontSize(9).fillColor("#444444");
  const contact =
    env.PAYOUT_STATEMENT_CONTACT_EMAIL ?? env.EMAIL_REPLY_TO ?? env.EMAIL_FROM ?? "support@lax.bid";
  doc.text(`Stripe transfer reference: ${pRow.stripeTransferId ?? "—"}`);
  doc.text(`Paid out: ${statement.paidOut ?? "—"}`);
  doc.text(`Questions: ${contact}`);
  doc.text(productCopyrightLine("bid"));
  doc.fillColor("#000000");

  doc.end();
  await finished(doc);
  return Buffer.concat(chunks);
}

export function payoutStatementObjectKey(legalEntityId: string, payoutId: string): string {
  return `payout-statements/${legalEntityId}/${payoutId}.pdf`;
}
