import "server-only";

import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getFinanceAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminSettlementPreview } from "@/lib/data/http/admin-payouts.reader";

export type SettlementSearchParams = {
  error?: string;
  success?: string;
};

export type SettlementPageModel = {
  success: string | null;
  error: string | null;
  navCounts: typeof EMPTY_ADMIN_NAV_COUNTS;
};

export async function loadSettlementPreview(legalEntityId: string) {
  "use server";
  return getAdminSettlementPreview(legalEntityId);
}

/** Data/composition boundary for `/admin/payouts/settlement`. */
export async function loadAdminSettlementPage(
  sp: SettlementSearchParams,
): Promise<SettlementPageModel> {
  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  try {
    navCounts = await getFinanceAdminNavCounts();
  } catch {
    /* use empty */
  }

  return {
    success: safeDecodeAdminErrorParam(sp.success),
    error: safeDecodeAdminErrorParam(sp.error),
    navCounts,
  };
}
