import type { LegalEntity } from "@auction/accounting-domain";
import type { ZohoBooksClient } from "../client.js";
import type { ZohoOrgConfig, ZohoOrgConfigs } from "./org-config.js";

/** The only part of the HTTP client the adapter uses: three calls, so a test can stand in for it. */
export type ZohoApi = Pick<ZohoBooksClient, "get" | "post" | "put">;

/** The organisation settings for a legal entity, or undefined when that entity is not set up. */
export function orgFor(orgs: ZohoOrgConfigs, entity: LegalEntity): ZohoOrgConfig | undefined {
  return orgs[entity];
}
