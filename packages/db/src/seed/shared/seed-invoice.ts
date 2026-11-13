/**
 * Invoices for seeded payments. Every seeded payment has a stored invoice with its lines, written
 * with the payment so the Pay page, Stripe and the staff lists read the same figures as in the
 * running application. Lines come from the application's own calculator (`buildInvoiceLines`),
 * never from a second formula in a seed.
 *
 * Test and local seeds only.
 */
import { invoiceDueAt } from "@auction/domain";
import type { InvoiceLine, InvoiceSource, Lot } from "@auction/types";
import { buildInvoiceLines } from "@auction/validators";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "../../schema/index.js";
import { uuidV5 } from "./ids.js";

type SeedDb = PgDatabase<NodePgQueryResultHKT, typeof schema>;

/** Namespace of the seeded invoice ids, so re-running a seed finds the same invoice rows. */
const SEED_INVOICE_NAMESPACE = "5d3c7a0e-6b1f-4f6a-9c53-0b7d2f4e8a11";

export type SeedInvoice = {
  id: string;
  lines: InvoiceLine[];
  totalPence: number;
  policyId: string | null;
  source: InvoiceSource;
  raisedAt: Date;
  /** End of the London day the term runs to, by the application's own rule. */
  dueAt: Date;
};

const invoiceIdFor = (paymentId: string) => uuidV5(SEED_INVOICE_NAMESPACE, paymentId);

/**
 * The lines of a lot sold at `hammerPounds`: at a flat premium `rate` (0.25 = 25%) when given,
 * else at the standard premium (15% up to £500,000, then 10% on the part above), as the application prices it.
 */
export function priceHammer(hammerPounds: number, rate: number | null = null) {
  return buildInvoiceLines(
    {
      currentPrice: hammerPounds.toFixed(2),
      buyerPremiumRate: rate === null ? null : rate.toFixed(4),
      saleId: null,
    } as unknown as Lot,
    null,
  );
}

/** The invoice a lot sold at `hammerPounds` is raised with. */
export function priceSeedInvoice(input: {
  paymentId: string;
  hammerPounds: number;
  /** A flat premium; left out (or `null`), the standard premium applies. */
  rate?: number | null;
  raisedAt: Date;
}): SeedInvoice {
  const priced = priceHammer(input.hammerPounds, input.rate ?? null);
  return {
    id: invoiceIdFor(input.paymentId),
    lines: priced.lines,
    totalPence: priced.totalPence,
    policyId: priced.policyId,
    source: "raised",
    raisedAt: input.raisedAt,
    dueAt: invoiceDueAt(input.raisedAt),
  };
}

/**
 * An invoice for a seeded payment whose amount is a fixture that was not worked out from a hammer
 * price: one total line, flagged as reconstructed like the migration's backfill does.
 */
export function totalOnlySeedInvoice(input: {
  paymentId: string;
  amountPounds: string;
  raisedAt: Date;
}): SeedInvoice {
  const totalPence = Math.round(Number.parseFloat(input.amountPounds) * 100);
  return {
    id: invoiceIdFor(input.paymentId),
    lines: [{ kind: "legacy_total", label: "Total", ratePercent: null, amountPence: totalPence }],
    totalPence,
    policyId: null,
    source: "legacy_backfill",
    raisedAt: input.raisedAt,
    dueAt: invoiceDueAt(input.raisedAt),
  };
}

export type SeedInvoiceOwner = {
  lotId: string;
  buyerLegalEntityId: string;
  sellerLegalEntityId: string;
  invoice: SeedInvoice;
};

/** Writes the invoices and their lines; the payments that settle them are written after. */
export async function insertSeedInvoices(
  db: SeedDb,
  owners: readonly SeedInvoiceOwner[],
): Promise<void> {
  if (owners.length === 0) return;
  // An invoice already stored for the lot and account (from an earlier run, or the migration's
  // backfill of an earlier seeded payment) is kept as it is, with its lines.
  const stored = await db
    .insert(schema.bidInvoice)
    .values(
      owners.map(({ lotId, buyerLegalEntityId, sellerLegalEntityId, invoice }) => ({
        id: invoice.id,
        lotId,
        buyerLegalEntityId,
        sellerLegalEntityId,
        totalPence: invoice.totalPence,
        raisedAt: invoice.raisedAt,
        dueAt: invoice.dueAt,
        pricingPolicyId: invoice.policyId,
        source: invoice.source,
        createdAt: invoice.raisedAt,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: schema.bidInvoice.id });
  const insertedIds = new Set(stored.map((row) => row.id));
  const fresh = owners.filter(({ invoice }) => insertedIds.has(invoice.id));
  if (fresh.length === 0) return;
  await db
    .insert(schema.bidInvoiceLine)
    .values(
      fresh.flatMap(({ invoice }) =>
        invoice.lines.map((line, index) => ({
          // A line is found again by its place on the invoice.
          id: uuidV5(SEED_INVOICE_NAMESPACE, `${invoice.id}:${index + 1}`),
          invoiceId: invoice.id,
          position: index + 1,
          kind: line.kind,
          label: line.label,
          ratePercent: line.ratePercent,
          amountPence: line.amountPence,
        })),
      ),
    )
    .onConflictDoNothing();
}

/** The pounds string of a whole-pence amount (`numeric(18,2)`), without floating point. */
export function penceToPounds(pence: number): string {
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
