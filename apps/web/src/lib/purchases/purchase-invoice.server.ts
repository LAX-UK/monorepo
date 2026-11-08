import "server-only";

import { purchasesApiFetch } from "./purchases-api.server";

/** The lot's invoice as the API's PDF, passed through as it comes. The API decides who may read it. */
export function fetchPurchaseInvoicePdf(lotId: string): Promise<Response> {
  return purchasesApiFetch(`/${encodeURIComponent(lotId)}/invoice.pdf`);
}
