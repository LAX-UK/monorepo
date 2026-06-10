/**
 * Org module is live on all deployments (launched).
 * Set `FORCE_ORG_MODULE=hidden` in the API environment as an emergency kill switch.
 */
export function isOrgModuleEnabled(_webOrigin: string): boolean {
  if (process.env.FORCE_ORG_MODULE === "hidden") return false;
  return true;
}

export function orgModuleDisabledResponse() {
  return {
    error: "Organisation module is not available yet",
    code: "ORG_MODULE_DISABLED" as const,
  };
}
