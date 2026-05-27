"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import {
  type AdminLegalEntityPickerRow,
  searchAdminLegalEntitiesForPicker,
} from "@/lib/data/http/admin.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import type { CapabilityRequirement } from "@auction/types";

const LEGAL_ENTITY_PICKER_ACCESS: CapabilityRequirement = {
  anyOf: ["legal_entity.read", "catalogue.write", "auction.manage", "platform.admin.full"],
};

export type SearchAdminLegalEntitiesBrowseInput = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type SearchAdminLegalEntitiesBrowseResult = {
  rows: AdminLegalEntityPickerRow[];
};

/** Staff-only legal entity search for admin pickers (server session cookies). */
export async function searchAdminLegalEntitiesBrowseAction(
  input: SearchAdminLegalEntitiesBrowseInput,
): Promise<ActionResult<SearchAdminLegalEntitiesBrowseResult>> {
  return instrumentServerAction("searchAdminLegalEntitiesBrowseAction", async () => {
    const denied = await denyUnlessAdminCapability(LEGAL_ENTITY_PICKER_ACCESS);
    if (denied) return denied;

    try {
      const rows = await searchAdminLegalEntitiesForPicker({
        ...(input.q?.trim() ? { q: input.q.trim() } : {}),
        limit: input.limit ?? 25,
        offset: input.offset ?? 0,
      });
      return actionSuccess({ rows });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Legal entity search failed";
      return actionFailure(message);
    }
  });
}

/** Resolve a legal entity row from browse results for picker selected-state display. */
export async function resolveAdminLegalEntityForPickerAction(
  legalEntityId: string,
): Promise<ActionResult<AdminLegalEntityPickerRow | null>> {
  return instrumentServerAction("resolveAdminLegalEntityForPickerAction", async () => {
    const denied = await denyUnlessAdminCapability(LEGAL_ENTITY_PICKER_ACCESS);
    if (denied) return denied;

    try {
      const rows = await searchAdminLegalEntitiesForPicker({
        q: legalEntityId,
        limit: 25,
        offset: 0,
      });
      return actionSuccess(rows.find((row) => row.id === legalEntityId) ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Legal entity lookup failed";
      return actionFailure(message);
    }
  });
}
