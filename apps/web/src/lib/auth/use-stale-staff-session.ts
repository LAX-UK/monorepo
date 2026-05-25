"use client";

import { useAppSession } from "@/lib/auth/use-app-session";

/** True when a staff user session is missing `staffRole` (stale cookie after role assignment). */
export function useStaleStaffSession(): boolean {
  const { user, pending } = useAppSession();
  if (pending || !user) return false;
  if (user.role !== "staff") return false;
  return user.staffRole == null;
}
