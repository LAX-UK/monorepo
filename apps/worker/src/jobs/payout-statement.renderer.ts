import { finished } from "node:stream/promises";
import PDFDocument from "pdfkit";
import type { WorkerEnv } from "../env.js";
import type {
  PayoutStatementEntityRow,
  PayoutStatementLineRow,
  PayoutStatementPayoutRow,
} from "../interfaces/payout-statement.repository.js";

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
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  return `${fmt(start)} — ${fmt(end)}`;
}

export async function renderPayoutStatementPdf(input: PayoutStatementRenderInput): Promise<Buffer> {
  const { payout: pRow, entity: entityRow, lines, authorNames, env } = input;
  const payoutId = pRow.id;

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const entityDisplayName =
    entityRow.legalName?.trim() || entityRow.displayName?.trim() || entityRow.id.slice(0, 8);

  doc.fontSize(18).text("LAX", { continued: false });
  doc.moveDown(0.25);
  doc.fontSize(14).text("Payout statement", { underline: true });
  doc.moveDown();
  doc.fontSize(10);
  doc.text(`Statement period: ${formatPeriod(pRow.periodStart, pRow.periodEnd)}`);
  doc.text(`Entity: ${entityDisplayName}`);
  if (entityRow.vatNumber) {
    doc.text(`VAT number: ${entityRow.vatNumber}`);
  }
  doc.text(`Payout reference: ${payoutId}`);
  doc.moveDown();

  const gross = pRow.grossAmount;
  const pf = pRow.platformFee;
  const sf = pRow.stripeFee;
  const net = pRow.netAmount;
  const currency = pRow.currency;
  const feePct =
    Number.parseFloat(gross) > 0
      ? ((Number.parseFloat(pf) / Number.parseFloat(gross)) * 100).toFixed(2)
      : "0.00";

  doc.fontSize(11).text("Line items", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(9);
  for (const line of lines) {
    const kind = line.kind;
    let desc: string;
    if (line.paymentId && line.lotTitle) {
      const lotRef =
        line.lotNumber != null ? `Lot #${line.lotNumber}` : `Lot ${line.paymentId.slice(0, 8)}`;
      const buyer = line.buyerName?.trim() || "—";
      desc = `${lotRef} — ${line.lotTitle} — buyer: ${buyer}`;
    } else if (kind === "adjustment") {
      desc = `Adjustment${line.note ? `: ${line.note}` : ""}`;
    } else {
      desc = `${kind}${line.note ? ` — ${line.note}` : ""}`;
    }
    doc.text(`• [${kind}] ${moneyFmt(String(line.amount), currency)} — ${desc}`);
  }

  doc.moveDown();
  doc.fontSize(11).text("Totals", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(10);
  doc.text(`Gross: ${moneyFmt(gross, currency)}`);
  doc.text(`Platform fee: ${moneyFmt(pf, currency)} (${feePct}% of gross)`);
  doc.text(`Stripe fee: ${moneyFmt(sf, currency)}`);
  doc.text(`Net payable: ${moneyFmt(net, currency)}`);
  doc.text(`Currency: ${currency}`);

  doc.addPage();
  doc.fontSize(12).text("Administrator appendix", { underline: true });
  doc.moveDown();
  doc.fontSize(10);
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
  doc.text(
    `Settlement / processed: ${pRow.processedAt ? pRow.processedAt.toISOString().slice(0, 10) : "—"}`,
  );
  doc.text(`Questions: ${contact}`);
  doc.fillColor("#000000");

  doc.end();
  await finished(doc);
  return Buffer.concat(chunks);
}

export function payoutStatementObjectKey(legalEntityId: string, payoutId: string): string {
  return `payout-statements/${legalEntityId}/${payoutId}.pdf`;
}
