/** The Zoho modes the worker can run with; a structural type so the env schema can use it too. */
export type ZohoModes = {
  APP_ENV: "production" | "test" | "development";
  ZOHO_CRM_SYNC_MODE: "off" | "dry_run" | "canary" | "live";
  ZOHO_ARTWORK_SYNC_MODE: "off" | "dry_run" | "live";
  ZOHO_ARTWORK_WRITEBACK_MODE: "off" | "dry_run" | "live";
  ZOHO_ARTWORK_LISTING_MODE: "off" | "dry_run" | "live";
  ZOHO_FULFILMENT_MIRROR_MODE: "off" | "dry_run" | "live";
  ZOHO_QC_READY_MODE: "off" | "dry_run" | "live";
};

/**
 * Anything that writes to Zoho CRM: the CRM sync in canary/live, or the artwork writeback, the
 * LAX listing or the fulfilment mirror in live. The CRM sync's `canary` is `live` under another
 * name: it writes the same, and a canary rollout is made by narrowing ZOHO_CRM_ENABLED_EVENT_TYPES.
 */
export function writesToZohoCrm(env: ZohoModes): boolean {
  return (
    env.ZOHO_CRM_SYNC_MODE === "live" ||
    env.ZOHO_CRM_SYNC_MODE === "canary" ||
    env.ZOHO_ARTWORK_WRITEBACK_MODE === "live" ||
    env.ZOHO_ARTWORK_LISTING_MODE === "live" ||
    env.ZOHO_FULFILMENT_MIRROR_MODE === "live"
  );
}

/**
 * Whether the worker acts on what a Zoho CRM org holds. Writes always count. Outside production
 * the live artwork sync and quality-check reads count too: they bring Zoho data into a test or
 * local stack, so they must come from a sandbox org, the same way Zoho Books writes are tied to
 * the org's environment.
 */
export function actsOnZohoCrm(env: ZohoModes): boolean {
  if (writesToZohoCrm(env)) return true;
  return (
    !isProductionZohoStack(env) &&
    (env.ZOHO_ARTWORK_SYNC_MODE === "live" || env.ZOHO_QC_READY_MODE === "live")
  );
}

/**
 * Only APP_ENV=production may act on a production Zoho CRM org. APP_ENV defaults to development
 * when it is unset, so a deployed test host with APP_ENV unset or mis-set is treated as "not
 * production" and needs the sandbox org: the rule fails closed.
 */
export function isProductionZohoStack(env: Pick<ZohoModes, "APP_ENV">): boolean {
  return env.APP_ENV === "production";
}

/** Outside production, anything that acts on Zoho CRM must be pinned to a sandbox org. */
export function zohoCrmNeedsSandboxOrg(env: ZohoModes): boolean {
  return !isProductionZohoStack(env) && actsOnZohoCrm(env);
}
