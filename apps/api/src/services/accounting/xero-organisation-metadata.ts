import type { XeroClient } from "xero-node";
import type { IXeroConnectionRepository } from "../interfaces/xero-repositories.js";

/** Fetch organisation short code and base currency after OAuth connect. Non-fatal on failure. */
export async function fetchAndCacheXeroOrganisationMetadata(
  xero: XeroClient,
  tenantId: string,
  connections: IXeroConnectionRepository,
): Promise<void> {
  try {
    const res = await xero.accountingApi.getOrganisations(tenantId);
    const org = res.body.organisations?.[0];
    if (!org) return;
    await connections.updateOrgMetadata(tenantId, {
      orgShortCode: org.shortCode ?? null,
      orgBaseCurrency: org.baseCurrency != null ? String(org.baseCurrency) : null,
    });
  } catch {
    // Metadata is optional for admin display; do not fail OAuth.
  }
}
