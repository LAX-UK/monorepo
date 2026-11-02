import type { AdminReleaseAlertSummary } from "@auction/shop-contracts";
import { fetchAdminJson } from "./load-admin-data";

/**
 * The release alert list's size, for the Leads page. A failure yields null rather than an error:
 * a missing figure must never stop the list beneath it from rendering.
 */
export async function loadReleaseAlertSummary(
  capabilities: readonly string[],
): Promise<AdminReleaseAlertSummary | null> {
  if (!capabilities.includes("lead.read")) return null;
  const result = await fetchAdminJson<AdminReleaseAlertSummary>("release-alerts/summary");
  return result.status === "ok" ? result.data : null;
}
