import "server-only";

import { resolveAdminReturnPath } from "@/lib/admin/admin-return-path.server";
import type { SessionUser } from "@/lib/data/contracts";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { adminDenialDestination, canOpenAdminRoute } from "@/lib/navigation/admin-route-access";
import type { CapabilityRequirement, UserRole } from "@auction/types";
import { redirect } from "next/navigation";

/**
 * Server-side gate for an admin section: signs people in and back, and sends a role that cannot
 * open the section to a page that says so (its own overview when it asked for the admin home).
 */
export async function requireAdminCapability(
  req: CapabilityRequirement,
  returnTo: string,
): Promise<SessionUser> {
  const resume = await resolveAdminReturnPath();
  const section = returnTo.split("?")[0] ?? returnTo;
  const user = await getServerSessionUser();
  if (!user) {
    const next = resume.startsWith(section) ? resume : returnTo;
    redirect(`/login?next=${encodeURIComponent(next)}&auth=required`);
  }
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  if (!canOpenAdminRoute(role, staffRole, section, req)) {
    const requested = resume.startsWith(section) ? resume : section;
    redirect(adminDenialDestination(role, staffRole, requested));
  }
  return user;
}
