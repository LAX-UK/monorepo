import type { AdminRegisterCounts } from "@auction/shop-contracts";
import { fetchAdminJson } from "./load-admin-data";

/**
 * How many artworks wait in the From Zoho queues, for the Overview. A failure yields null rather
 * than an error: a missing line must never stop the Overview from rendering.
 */
export async function loadRegisterQueueCounts(
  capabilities: readonly string[],
): Promise<AdminRegisterCounts | null> {
  if (!capabilities.includes("artwork_register.read")) return null;
  const result = await fetchAdminJson<AdminRegisterCounts>("artwork-register/counts");
  return result.status === "ok" ? result.data : null;
}
