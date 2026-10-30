import { finished } from "node:stream/promises";
import { legalEntityFor, productCopyrightLine } from "@auction/branding";
import PDFDocument from "pdfkit";

/** What a consignment agreement document says, already worded for the seller. */
export type ConsignmentAgreementDocument = {
  /** The consignment's reference, for example "C-1042". */
  reference: string;
  workTitle: string;
  /** Who the work is consigned for: the organisation or the person. */
  sellerName: string;
  currency: string;
  estimateLow: string | null;
  estimateHigh: string | null;
  reservePrice: string | null;
  /** The seller's commission as a percentage, for example "15". */
  commissionPercent: string | null;
  /** The lowest reserve the specialist accepts for a relist, when set. */
  relistReserveFloor: string | null;
  /** The seller conditions the terms are under, by version. */
  termsVersion: string;
  proposedAt: Date;
  /** Who accepted and when; `null` while it waits for acceptance. */
  accepted: { byName: string | null; at: Date } | null;
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/London",
});

function money(amount: string | null, currency: string): string {
  if (amount === null) return "To be confirmed";
  const n = Number.parseFloat(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);
}

/** One label and value per row, the way the agreement panel lists them. */
function rows(doc: PDFKit.PDFDocument, entries: readonly (readonly [string, string])[]): void {
  for (const [label, value] of entries) {
    const y = doc.y;
    doc.font("Helvetica").fillColor("#555555").text(label, 50, y, { width: 170 });
    doc.font("Helvetica").fillColor("#111111").text(value, 230, y, { width: 315 });
    doc.moveDown(0.4);
  }
}

/**
 * The consignment agreement as a PDF the seller keeps: the estimate, reserve and commission the
 * specialist proposed, the seller conditions they are under, and who accepted them and when.
 * It is rendered from the stored agreement each time, so it always matches the record.
 */
export async function renderConsignmentAgreementPdf(
  input: ConsignmentAgreementDocument,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4", info: { Title: "Consignment agreement" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const issuer = legalEntityFor("bid");

  doc.font("Helvetica-Bold").fontSize(18).text("LAX Bid");
  doc.font("Helvetica").fontSize(9).fillColor("#555555");
  doc.text(`${issuer.name}, ${issuer.registeredAddress.inline}`);
  doc.moveDown(1.2);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#111111").text("Consignment agreement");
  doc.font("Helvetica").fontSize(10).fillColor("#555555").text(`Reference ${input.reference}`);
  doc.moveDown(1);

  doc.fontSize(10);
  rows(doc, [
    ["Work", input.workTitle],
    ["Consigned for", input.sellerName],
    ["Low estimate", money(input.estimateLow, input.currency)],
    ["High estimate", money(input.estimateHigh, input.currency)],
    [
      "Reserve",
      input.reservePrice === null ? "No reserve" : money(input.reservePrice, input.currency),
    ],
    [
      "Seller's commission",
      input.commissionPercent === null
        ? "To be confirmed"
        : `${input.commissionPercent}% of the hammer price`,
    ],
    ...(input.relistReserveFloor !== null
      ? ([["Lowest reserve if relisted", money(input.relistReserveFloor, input.currency)]] as const)
      : []),
    ["Proposed", dateFmt.format(input.proposedAt)],
  ]);

  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text("Terms", 50);
  doc.font("Helvetica").fontSize(10).moveDown(0.3);
  doc.text(
    `These terms are given under the Conditions for Sellers and Consignors (Part C of the Conditions of Business), version "${input.termsVersion}". The conditions in force at acceptance apply to this consignment.`,
    { width: 495 },
  );

  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(11).text("Acceptance");
  doc.font("Helvetica").fontSize(10).moveDown(0.3);
  doc.text(
    input.accepted
      ? `Accepted by ${input.accepted.byName ?? "the seller"} for ${input.sellerName} on ${dateFmt.format(input.accepted.at)}.`
      : "Not accepted yet. Accept it in your LAX Bid account to confirm the consignment.",
    { width: 495 },
  );

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#555555").text(productCopyrightLine("bid"));
  doc.end();
  await finished(doc);
  return Buffer.concat(chunks);
}
