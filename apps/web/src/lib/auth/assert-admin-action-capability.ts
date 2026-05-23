import "server-only";

import { getServerSessionUser } from "@/lib/data/http/session.server";
import type { ActionResult } from "@/lib/forms/form-result";
import { actionFailure } from "@/lib/forms/form-result";
import { type CapabilityRequirement, type UserRole, userHasAccessTo } from "@auction/types";

/** Returns an ActionResult denial when the session lacks the required capability. */
export async function denyUnlessAdminCapability(
  req: CapabilityRequirement,
): Promise<ActionResult<never> | null> {
  const user = await getServerSessionUser();
  if (!user) {
    return actionFailure("Sign in required", undefined, 401);
  }
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  if (!userHasAccessTo(role, staffRole, req)) {
    return actionFailure("You do not have permission to perform this action", undefined, 403);
  }
  return null;
}

/** Throws redirect-style failure for form actions that use redirect() on error. */
export async function assertAdminCapabilityForRedirect(
  req: CapabilityRequirement,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getServerSessionUser();
  if (!user) {
    return { ok: false, message: "Sign in required" };
  }
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  if (!userHasAccessTo(role, staffRole, req)) {
    return { ok: false, message: "You do not have permission to perform this action" };
  }
  return { ok: true };
}
