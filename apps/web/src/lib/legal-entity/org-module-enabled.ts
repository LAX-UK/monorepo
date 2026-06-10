const PRODUCTION_HOSTS = new Set(["lax.bid", "www.lax.bid"]);

export function normalizeHostname(host: string): string {
  return host.split(":")[0]?.trim().toLowerCase() ?? "";
}

export function isProductionWebHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.has(normalizeHostname(hostname));
}

/**
 * Org module is live on all hosts (launched).
 * `NEXT_PUBLIC_FORCE_ORG_MODULE=hidden` remains as an emergency kill switch.
 */
export function isOrgModuleEnabled(_hostname: string): boolean {
  if (process.env.NEXT_PUBLIC_FORCE_ORG_MODULE === "hidden") return false;
  return true;
}
