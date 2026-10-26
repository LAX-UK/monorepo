import type { LegalEntity } from "@auction/branding";
import PDFDocument from "pdfkit";
import { orderRecordVat } from "./order-vat.js";
import type { OrderRecord } from "./ports/commerce.ports.js";

export type InvoiceCustomer = { name: string | null; email: string | null };

type InvoiceRow = { description: string; detail: string | null; vatRate: string; amount: string };

/** Everything the invoice prints, worked out before any drawing so it can be checked on its own. */
export type OrderInvoiceModel = {
  /** "VAT invoice" only when the supplier has a VAT number and the order recorded VAT. */
  title: "VAT invoice" | "Invoice";
  fileName: string;
  number: string;
  issuedOn: string;
  orderedOn: string;
  supplier: string[];
  customer: string[];
  deliverTo: string[] | null;
  rows: InvoiceRow[];
  totals: Array<{ label: string; value: string; emphasis?: boolean }>;
  notes: string[];
};

const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

const day = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);

const percent = (rateBp: number) => `${Number((rateBp / 100).toFixed(2))}%`;

const FULFILMENT_LINE: Record<OrderRecord["fulfilment"], string> = {
  uk_insured_delivery: "UK insured delivery",
  collect_new_cavendish: "Collection from our London gallery",
  collect_brunswick: "Collection in London",
  lax_storage: "Storage with LAX",
  international_quotation: "Delivery outside the UK",
};

/**
 * The invoice for a paid order. Its number is the order reference, which is issued once and in
 * sequence. The supply date is the payment date, so the invoice is dated then too.
 */
export function buildOrderInvoiceModel(input: {
  order: OrderRecord;
  customer: InvoiceCustomer;
  supplier: LegalEntity;
  vatNumber: string | null;
}): OrderInvoiceModel {
  const { order, supplier } = input;
  const paidAt = order.paidAt ?? order.createdAt;
  const vat = orderRecordVat(order);
  const vatInvoice = Boolean(input.vatNumber) && vat !== null;
  const lineRate = (rateBp: number | null) => (rateBp ? percent(rateBp) : "—");

  const rows: InvoiceRow[] = order.lines.map((line) => {
    const title = line.productTitle ?? line.artworkTitle ?? "Item";
    const edition =
      line.editionNumber !== null
        ? line.editionSize
          ? `Edition ${line.editionNumber} of ${line.editionSize}`
          : `Edition ${line.editionNumber}`
        : line.variantSku
          ? `SKU ${line.variantSku}`
          : null;
    const detail = [line.artistName, edition].filter(Boolean).join(" · ") || null;
    return {
      description: title,
      detail,
      vatRate: lineRate(line.vatRateBp),
      amount: money(line.unitPricePence),
    };
  });
  rows.push({
    description: FULFILMENT_LINE[order.fulfilment],
    detail: null,
    vatRate: vat?.rateBp ? percent(vat.rateBp) : "—",
    amount: order.fulfilmentSurchargePence === 0 ? "Free" : money(order.fulfilmentSurchargePence),
  });

  const totals: OrderInvoiceModel["totals"] = vat
    ? [
        { label: "Total excluding VAT", value: money(vat.netPence) },
        {
          label: vat.rateBp ? `VAT at ${percent(vat.rateBp)}` : "VAT",
          value: money(vat.vatPence),
        },
        { label: "Total paid", value: money(order.totalPence), emphasis: true },
      ]
    : [{ label: "Total paid", value: money(order.totalPence), emphasis: true }];

  const address = order.deliveryAddress;
  const deliverTo = address
    ? [
        address.recipientName,
        address.line1,
        address.line2,
        `${address.city} ${address.postcode}`,
        address.country === "GB" ? "United Kingdom" : address.country,
      ].filter((line): line is string => Boolean(line))
    : null;

  const notes = [
    "Prices include VAT.",
    ...order.refunds
      .filter((refund) => refund.status === "succeeded" && refund.refundedAt)
      .map(
        (refund) =>
          `${money(refund.amountPence)} was refunded on ${day(refund.refundedAt as Date)} to the original payment method.`,
      ),
  ];

  return {
    title: vatInvoice ? "VAT invoice" : "Invoice",
    fileName: `${order.reference}-invoice.pdf`,
    number: order.reference,
    issuedOn: day(paidAt),
    orderedOn: day(order.createdAt),
    supplier: [
      supplier.name,
      ...supplier.registeredAddress.lines,
      ...(supplier.companyNumber ? [`Company number ${supplier.companyNumber}`] : []),
      ...(input.vatNumber ? [`VAT number ${input.vatNumber}`] : []),
    ],
    customer: [input.customer.name ?? address?.recipientName ?? null, input.customer.email].filter(
      (line): line is string => Boolean(line),
    ),
    deliverTo,
    rows,
    totals,
    notes,
  };
}

const INK = "#111111";
const MUTED = "#5b5f66";
const RULE = "#d9dbde";

/** Draws the invoice on A4 in the built-in Helvetica, so it renders the same on every server. */
export async function renderOrderInvoicePdf(
  model: OrderInvoiceModel,
  options: { compress?: boolean } = {},
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 56,
    compress: options.compress ?? true,
    info: { Title: `${model.title} ${model.number}`, Author: model.supplier[0] ?? "LAX Shop" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const right = left + width;

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(18).text("LAX Shop", left, 56);
  doc.font("Helvetica-Bold").fontSize(14).text(model.title, left, 58, { width, align: "right" });

  let y = 100;
  const facts: Array<[string, string]> = [
    ["Invoice number", model.number],
    ["Invoice date", model.issuedOn],
    ["Order date", model.orderedOn],
  ];
  for (const [label, value] of facts) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(label, right - 220, y, { width: 100 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(INK)
      .text(value, right - 120, y, {
        width: 120,
        align: "right",
      });
    y += 14;
  }

  const block = (heading: string, lines: string[], x: number, top: number, blockWidth: number) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(heading, x, top, {
      width: blockWidth,
    });
    let lineY = top + 14;
    for (const line of lines) {
      doc.font("Helvetica").fontSize(10).fillColor(INK).text(line, x, lineY, { width: blockWidth });
      lineY = doc.y + 1;
    }
    return lineY;
  };

  const top = 160;
  const column = (width - 32) / 3;
  const bottoms = [
    block("From", model.supplier, left, top, column),
    block(
      "Bill to",
      model.customer.length ? model.customer : ["—"],
      left + column + 16,
      top,
      column,
    ),
    model.deliverTo
      ? block("Deliver to", model.deliverTo, left + (column + 16) * 2, top, column)
      : top,
  ];
  y = Math.max(...bottoms) + 24;

  const cols = { description: left, vat: right - 170, amount: right - 90 };
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED);
  doc.text("Description", cols.description, y);
  doc.text("VAT rate", cols.vat, y, { width: 70, align: "right" });
  doc.text("Amount", cols.amount, y, { width: 90, align: "right" });
  y += 16;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.75).strokeColor(RULE).stroke();
  y += 10;

  for (const row of model.rows) {
    doc.font("Helvetica").fontSize(10).fillColor(INK);
    doc.text(row.description, cols.description, y, { width: cols.vat - left - 16 });
    let rowBottom = doc.y;
    if (row.detail) {
      doc
        .fontSize(9)
        .fillColor(MUTED)
        .text(row.detail, cols.description, rowBottom + 2, {
          width: cols.vat - left - 16,
        });
      rowBottom = doc.y;
    }
    doc.fontSize(10).fillColor(INK);
    doc.text(row.vatRate, cols.vat, y, { width: 70, align: "right" });
    doc.text(row.amount, cols.amount, y, { width: 90, align: "right" });
    y = rowBottom + 10;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(RULE).stroke();
    y += 10;
  }

  y += 4;
  for (const total of model.totals) {
    doc
      .font(total.emphasis ? "Helvetica-Bold" : "Helvetica")
      .fontSize(total.emphasis ? 11 : 10)
      .fillColor(total.emphasis ? INK : MUTED)
      .text(total.label, right - 260, y, { width: 160, align: "right" });
    doc.fillColor(INK).text(total.value, cols.amount, y, { width: 90, align: "right" });
    y += total.emphasis ? 20 : 16;
  }

  y += 16;
  for (const note of model.notes) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(note, left, y, { width });
    y = doc.y + 4;
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}
