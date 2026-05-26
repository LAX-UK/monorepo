"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { getAdminLotBrowseFallback } from "@/lib/admin/lot-browse-fallback";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import {
  AdminLotBrowseError,
  type AdminLotPickerRow,
  getAdminLotBrowse,
} from "@/lib/data/http/admin.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";

export type SearchAdminLotsBrowseInput = {
  q?: string;
  state?: "available" | "returned" | "all";
  excludeSaleId?: string;
  sellerLegalEntityId?: string;
  limit?: number;
  offset?: number;
};

export type SearchAdminLotsBrowseResult = {
  rows: AdminLotPickerRow[];
  total: number;
};

/** Staff-only attachable lot search for admin pickers (server session cookies). */
export async function searchAdminLotsBrowseAction(
  input: SearchAdminLotsBrowseInput,
): Promise<ActionResult<SearchAdminLotsBrowseResult>> {
  return instrumentServerAction("searchAdminLotsBrowseAction", async () => {
    const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
    if (denied) return denied;

    try {
      const browseParams = {
        ...(input.q?.trim() ? { q: input.q.trim() } : {}),
        ...(input.state ? { state: input.state } : {}),
        ...(input.excludeSaleId ? { excludeSaleId: input.excludeSaleId } : {}),
        ...(input.sellerLegalEntityId ? { sellerLegalEntityId: input.sellerLegalEntityId } : {}),
        limit: input.limit ?? 25,
        offset: input.offset ?? 0,
      };

      let rows: AdminLotPickerRow[];
      let total: number;
      try {
        ({ rows, total } = await getAdminLotBrowse(browseParams));
      } catch (err) {
        if (err instanceof AdminLotBrowseError && err.status === 404) {
          ({ rows, total } = await getAdminLotBrowseFallback(browseParams));
        } else {
          throw err;
        }
      }

      return actionSuccess({ rows, total });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lot search failed";
      return actionFailure(message);
    }
  });
}
