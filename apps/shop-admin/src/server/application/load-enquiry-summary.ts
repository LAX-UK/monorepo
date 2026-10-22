import type { AdminEnquirySummary } from "@auction/shop-contracts";
import { fetchAdminJson } from "./load-admin-data";

/**
 * Counts for the navigation badge and the overview tile. A failure yields null rather than an
 * error: a missing badge must never stop a page that does not depend on it from rendering.
 */
export async function loadEnquirySummary(
  capabilities: readonly string[],
): Promise<AdminEnquirySummary | null> {
  if (!capabilities.includes("enquiry.read")) return null;
  const result = await fetchAdminJson<AdminEnquirySummary>("enquiries/summary");
  return result.status === "ok" ? result.data : null;
}
