import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";

/** The Pay page for these lots: one payment for one invoice or several. */
export function payHref(
  lotIds: readonly string[],
  options: { returned?: "cancelled" } = {},
): string {
  const query = [
    lotIds.length > 0 ? `lots=${lotIds.map(encodeURIComponent).join(",")}` : null,
    options.returned ? `returned=${options.returned}` : null,
  ].filter((part): part is string => part !== null);
  return query.length === 0 ? CLIENT_ROUTES.pay : `${CLIENT_ROUTES.pay}?${query.join("&")}`;
}

/** What the Pay page reads from `?returned=`: only the one value it writes itself. */
export function parsePayReturned(raw: string | string[] | undefined): "cancelled" | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "cancelled" ? "cancelled" : null;
}
