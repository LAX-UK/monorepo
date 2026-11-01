import "server-only";

import { paymentLinkAccess } from "@/lib/admin/finance/payment-link-access";
import { getDisputeDeskCase } from "@/lib/data/http/dispute-desk.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { DISPUTE_ALLOCATION_WRITE_ACCESS, type UserRole, userHasAccessTo } from "@auction/types";

/** A dispute case with what the signed-in person may do on it; null when there is no such case. */
export async function loadAdminDisputeCasePage(caseId: string, now = new Date()) {
  const [found, sessionUser] = await Promise.all([
    getDisputeDeskCase(caseId),
    getServerSessionUser(),
  ]);
  if (!found) return null;
  const role = (sessionUser?.role ?? "client") as UserRole;
  const staffRoles = sessionUser?.staffRoles;
  return {
    found,
    nowIso: now.toISOString(),
    canAllocate: userHasAccessTo(role, staffRoles, DISPUTE_ALLOCATION_WRITE_ACCESS),
    canOpenClient: paymentLinkAccess(role, staffRoles).canOpenClient,
  };
}
