import "server-only";

import { resolveAdminReturnPath } from "@/lib/admin/admin-return-path.server";
import type { SessionUser } from "@/lib/data/contracts";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  type CapabilityRequirement,
  type UserRole,
  staffRoleDefaultDestination,
  userHasAccessTo,
} from "@auction/types";
import { redirect } from "next/navigation";

/** Server-side gate for catalog admin routes; redirects unauthenticated or under-privileged staff. */
export async function requireAdminCapability(
  req: CapabilityRequirement,
  returnTo: string,
): Promise<SessionUser> {
  const user = await getServerSessionUser();
  if (!user) {
    const resume = await resolveAdminReturnPath();
    const next = resume.startsWith(returnTo.split("?")[0] ?? returnTo) ? resume : returnTo;
    redirect(`/login?next=${encodeURIComponent(next)}&auth=required`);
  }
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  if (!userHasAccessTo(role, staffRole, req)) {
    const dest = staffRoleDefaultDestination(role, staffRole);
    const destPath = dest.split("?")[0] ?? dest;
    const returnPath = returnTo.split("?")[0] ?? returnTo;
    if (destPath !== returnPath) {
      redirect(dest);
    }
  }
  return user;
}
