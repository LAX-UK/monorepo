"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { type AdminAuditActorOption, searchAdminAuditActors } from "@/lib/data/http/admin.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { AUDIT_DOMAIN_EVENTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

/** People who appear in the audit log, for the log's actor filter. */
export async function searchAuditActorsAction(
  query: string,
): Promise<ActionResult<{ actors: AdminAuditActorOption[] }>> {
  return instrumentServerAction("searchAuditActorsAction", async () => {
    const denied = await denyUnlessAdminCapability(AUDIT_DOMAIN_EVENTS_ACCESS);
    if (denied) return denied;

    try {
      const actors = await searchAdminAuditActors({
        ...(query.trim() ? { q: query.trim().slice(0, 100) } : {}),
        limit: 20,
      });
      return actionSuccess({ actors });
    } catch {
      return actionFailure("People could not be searched. Try again.");
    }
  });
}
