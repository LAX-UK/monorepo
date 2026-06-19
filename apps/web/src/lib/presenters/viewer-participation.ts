import type { SessionUser } from "@/lib/data/contracts";
import { type UserRole, roleHasCapability } from "@auction/types";

export type ViewerParticipation = {
  isAuthenticated: boolean;
  isStaff: boolean;
  canParticipateAsBuyer: boolean;
};

/** True when the user lacks `bid.place` (staff accounts). Guests are not blocked. */
export function isAdminBuyerBlocked(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  return !roleHasCapability(user.role as UserRole, "bid.place", user.staffRole ?? null);
}

/** Derives marketing viewer participation flags from the session (single source of truth). */
export function resolveViewerParticipation(session: SessionUser | null): ViewerParticipation {
  const isAuthenticated = Boolean(session);
  const isStaff = session?.role === "staff";
  const canParticipateAsBuyer = !isAdminBuyerBlocked(session);

  return {
    isAuthenticated,
    isStaff,
    canParticipateAsBuyer,
  };
}
