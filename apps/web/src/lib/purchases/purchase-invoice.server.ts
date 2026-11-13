import "server-only";

import { PURCHASE_INVOICE_STATES, type PurchaseInvoiceCard } from "@auction/types";
import { z } from "zod";
import { purchasesApiFetch } from "./purchases-api.server";

/** The lot's invoice as the API's PDF, passed through as it comes. The API decides who may read it. */
export function fetchPurchaseInvoicePdf(lotId: string): Promise<Response> {
  return purchasesApiFetch(`/${encodeURIComponent(lotId)}/invoice.pdf`);
}

/** LAX's stored copy of a Books invoice or credit note, passed through as it comes. */
export function fetchPurchaseDocumentPdf(lotId: string, documentId: string): Promise<Response> {
  return purchasesApiFetch(
    `/${encodeURIComponent(lotId)}/documents/${encodeURIComponent(documentId)}`,
  );
}

const isoInstant = z.string().datetime();

const invoiceCardSchema = z.object({
  state: z.enum(PURCHASE_INVOICE_STATES),
  invoiceNumber: z.string().min(1).nullable(),
  issuedAt: isoInstant.nullable(),
  invoiceDocumentId: z.string().uuid().nullable(),
  cancelledAt: isoInstant.nullable(),
  totalPence: z.number().int().nonnegative(),
  creditNotes: z.array(
    z.object({
      documentId: z.string().uuid(),
      number: z.string().min(1),
      amountPence: z.number().int().positive(),
    }),
  ),
}) satisfies z.ZodType<PurchaseInvoiceCard, z.ZodTypeDef, unknown>;

/**
 * The purchase's invoice card (Books), or `null` when it cannot be read or the member does not
 * pay the invoice: the page then shows LAX's own invoice as before.
 */
export async function getServerPurchaseInvoiceCard(
  lotId: string,
): Promise<PurchaseInvoiceCard | null> {
  const res = await purchasesApiFetch(`/${encodeURIComponent(lotId)}/invoice-card`).catch(
    () => null,
  );
  if (!res?.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = invoiceCardSchema.safeParse(body.data);
  return parsed.success ? parsed.data : null;
}
