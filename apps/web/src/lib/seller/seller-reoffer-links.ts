import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";

/** The page where a seller answers, or reads the outcome of, one request to re-offer their lot. */
export function sellerReofferHref(reofferId: string): string {
  return `${CLIENT_ROUTES.payouts}/offers/${encodeURIComponent(reofferId)}`;
}
