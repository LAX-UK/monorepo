import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";

/** Where a won lot's invoice downloads from: our own PDF, made from the stored invoice. */
export function purchaseInvoiceHref(lotId: string): string {
  return `${CLIENT_ROUTES.purchases}/${encodeURIComponent(lotId)}/invoice`;
}
