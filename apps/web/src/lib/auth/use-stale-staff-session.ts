"use client";

import { authClient } from "@/lib/auth-client";

/** True when a staff user session is missing `staffRole` (stale cookie after role assignment). */
export function useStaleStaffSession(): boolean {
  const { data, isPending } = authClient.useSession();
  if (isPending || !data?.user) return false;
  const user = data.user;
  const role = typeof user.role === "string" ? user.role : null;
  if (role !== "staff") return false;
  const staffRole = user.staffRole;
  return staffRole == null || staffRole === "";
}
