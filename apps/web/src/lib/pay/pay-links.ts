import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";

/** The Pay page for these lots: one payment for one invoice or several. */
export function payHref(lotIds: readonly string[]): string {
  return lotIds.length === 0
    ? CLIENT_ROUTES.pay
    : `${CLIENT_ROUTES.pay}?lots=${lotIds.map(encodeURIComponent).join(",")}`;
}
