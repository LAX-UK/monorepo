import "server-only";

import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getFinanceAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminXeroIntegrationStatus } from "@/lib/data/http/admin.server";

export type XeroIntegrationSearchParams = {
  error?: string;
  connected?: string;
};

export type XeroIntegrationPageModel = {
  error: string | null;
  connected: boolean;
  status: Awaited<ReturnType<typeof getAdminXeroIntegrationStatus>> | null;
  navCounts: typeof EMPTY_ADMIN_NAV_COUNTS;
  loadError: string | null;
};

/** Data/composition boundary for `/admin/integrations/xero`. */
export async function loadAdminXeroIntegrationPage(
  sp: XeroIntegrationSearchParams,
): Promise<XeroIntegrationPageModel> {
  const error = safeDecodeAdminErrorParam(sp.error);
  const connected = sp.connected === "1";

  let status: Awaited<ReturnType<typeof getAdminXeroIntegrationStatus>> | null = null;
  let loadError: string | null = null;
  try {
    status = await getAdminXeroIntegrationStatus();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load Xero status.";
  }

  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  try {
    navCounts = await getFinanceAdminNavCounts();
  } catch {
    /* use empty */
  }

  return {
    error,
    connected,
    status,
    navCounts,
    loadError,
  };
}
