"use client";

import { bidStaffAccess } from "@/lib/admin/bid-staff-access";
import { StaffAccessProvider } from "@auction/staff-ui";
import type { StaffRoles, UserRole } from "@auction/types";
import { type ReactNode, useMemo } from "react";

/**
 * Gives every kit action in Bid admin the signed-in person's permissions, so an action they may
 * never take is left out on every page from the same rules the API checks.
 */
export function BidStaffAccessProvider({
  platformRole,
  staffRoles,
  children,
}: {
  /** Client or staff, from the session. */
  platformRole: UserRole;
  staffRoles: StaffRoles | undefined;
  children: ReactNode;
}) {
  const key = staffRoles?.join(",") ?? "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: the joined key stands for the roles.
  const access = useMemo(() => bidStaffAccess(platformRole, staffRoles), [platformRole, key]);
  return <StaffAccessProvider access={access}>{children}</StaffAccessProvider>;
}
