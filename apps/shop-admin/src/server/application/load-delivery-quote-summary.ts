import { fetchAdminJson } from "./load-admin-data";

/**
 * Delivery quote requests waiting for a price, for the count beside the nav entry. Only asked for
 * staff who can open orders; a failure yields null so a missing count never stops a page rendering.
 */
export async function loadDeliveryQuoteSummary(
  capabilities: readonly string[],
): Promise<{ waitingCount: number } | null> {
  if (!capabilities.includes("order.read")) return null;
  const result = await fetchAdminJson<{ waitingCount: number }>("orders/delivery-quotes/summary");
  return result.status === "ok" ? result.data : null;
}
