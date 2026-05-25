import "server-only";

import { headers } from "next/headers";
import { isOrgModuleEnabled } from "./org-module-enabled";

/** Resolve whether the org module is enabled for the current request host. */
export async function resolveOrgModuleEnabledFromRequest(): Promise<boolean> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? hdrs.get("x-forwarded-host") ?? "";
  return isOrgModuleEnabled(host);
}
