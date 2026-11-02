import "server-only";

import { getAdminSettlementPreview } from "@/lib/data/http/admin-payouts.reader";
import { SETTLEMENT_RESULTS, isSettlementResultCode } from "./settlement-result";

export type SettlementSearchParams = {
  result?: string | string[];
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
  const raw = Array.isArray(sp.result) ? sp.result[0] : sp.result;
  if (!isSettlementResultCode(raw)) return { success: null, error: null };
  const { tone, message } = SETTLEMENT_RESULTS[raw];
  return tone === "success" ? { success: message, error: null } : { success: null, error: message };
}
