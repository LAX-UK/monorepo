import "server-only";

import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminSettlementPreview } from "@/lib/data/http/admin-payouts.reader";

export type SettlementSearchParams = {
  error?: string;
  success?: string;
};

export type SettlementPageModel = {
  success: string | null;
  error: string | null;
};

export async function loadSettlementPreview(legalEntityId: string) {
  "use server";
  return getAdminSettlementPreview(legalEntityId);
}

/** Data/composition boundary for `/admin/payouts/settlement`. */
export async function loadAdminSettlementPage(
  sp: SettlementSearchParams,
): Promise<SettlementPageModel> {
  return {
    success: safeDecodeAdminErrorParam(sp.success),
    error: safeDecodeAdminErrorParam(sp.error),
  };
}
