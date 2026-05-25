const PRODUCTION_HOSTS = new Set(["lax.bid", "www.lax.bid"]);

function hostnameFromWebOrigin(webOrigin: string): string | null {
  try {
    return new URL(webOrigin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Org module is disabled when this API deployment serves the production web origin. */
export function isOrgModuleEnabled(webOrigin: string): boolean {
  const host = hostnameFromWebOrigin(webOrigin);
  if (!host) return true;
  return !PRODUCTION_HOSTS.has(host);
}

export function orgModuleDisabledResponse() {
  return {
    error: "Organisation module is not available yet",
    code: "ORG_MODULE_DISABLED" as const,
  };
}
