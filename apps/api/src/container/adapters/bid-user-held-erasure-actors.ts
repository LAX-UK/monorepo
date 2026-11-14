import { DATA_REQUESTS_MANAGE_ACCESS, userHasAccessTo } from "@auction/types";
import type { IHeldErasureActors } from "../../services/admin/data-requests/held-erasure-recheck.service.js";
import type { IBidUserContextLoader } from "../../services/interfaces/bid-user-context.js";

/**
 * Whether the staff member behind a held erasure may still erase for a data request: the roles in
 * force now, and an account that is neither suspended, disabled nor merged away, which is what
 * the Data requests routes require of a caller.
 */
export class BidUserHeldErasureActors implements IHeldErasureActors {
  constructor(private readonly contexts: Pick<IBidUserContextLoader, "loadContext">) {}

  async canManageDataRequests(userId: string): Promise<boolean> {
    const context = await this.contexts.loadContext(userId);
    if (!context) return false;
    if (context.suspendedAt || context.identityDisabledAt || context.mergedIntoSubjectId) {
      return false;
    }
    return userHasAccessTo(context.role, context.staffRoles, DATA_REQUESTS_MANAGE_ACCESS);
  }
}
