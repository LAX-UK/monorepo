import "server-only";

import { xeroCallbackErrorMessage } from "@/lib/admin/finance/xero-callback-error";
import { getAdminXeroIntegrationStatus } from "@/lib/data/http/admin.server";

export type XeroIntegrationSearchParams = {
  error?: string;
  connected?: string;
};

export type XeroIntegrationPageModel = {
  error: string | null;
  connected: boolean;
  status: Awaited<ReturnType<typeof getAdminXeroIntegrationStatus>> | null;
  loadError: string | null;
};

/** Data/composition boundary for `/admin/integrations/xero`. */
export async function loadAdminXeroIntegrationPage(
  sp: XeroIntegrationSearchParams,
): Promise<XeroIntegrationPageModel> {
  const error = xeroCallbackErrorMessage(sp.error);
  const connected = sp.connected === "1";

  let status: Awaited<ReturnType<typeof getAdminXeroIntegrationStatus>> | null = null;
  let loadError: string | null = null;
  try {
    status = await getAdminXeroIntegrationStatus();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load Xero status.";
  }

  return {
    error,
    connected,
    status,
    loadError,
  };
}
