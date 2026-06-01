"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import {
  type AdminUserRow,
  getAdminUserById,
  getAdminUserList,
} from "@/lib/data/http/admin.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { USER_PICKER_ACCESS } from "@/lib/navigation/staff-nav-access";

export type SearchAdminUsersBrowseInput = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type SearchAdminUsersBrowseResult = {
  rows: AdminUserRow[];
  total: number;
};

/** Staff-only user search for admin pickers (server session cookies). */
export async function searchAdminUsersBrowseAction(
  input: SearchAdminUsersBrowseInput,
): Promise<ActionResult<SearchAdminUsersBrowseResult>> {
  return instrumentServerAction("searchAdminUsersBrowseAction", async () => {
    const denied = await denyUnlessAdminCapability(USER_PICKER_ACCESS);
    if (denied) return denied;

    try {
      const data = await getAdminUserList({
        ...(input.q?.trim() ? { q: input.q.trim() } : {}),
        limit: input.limit ?? 10,
        offset: input.offset ?? 0,
      });
      return actionSuccess(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "User search failed";
      return actionFailure(message);
    }
  });
}

/** Resolve a single user row for picker selected-state display. */
export async function resolveAdminUserForPickerAction(
  userId: string,
): Promise<ActionResult<AdminUserRow | null>> {
  return instrumentServerAction("resolveAdminUserForPickerAction", async () => {
    const denied = await denyUnlessAdminCapability(USER_PICKER_ACCESS);
    if (denied) return denied;

    try {
      const user = await getAdminUserById(userId);
      return actionSuccess(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "User lookup failed";
      return actionFailure(message);
    }
  });
}
