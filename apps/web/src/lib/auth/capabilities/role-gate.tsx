"use client";

import type { UserRole, UserStaffRole } from "@auction/types";
import type { ReactNode } from "react";
import { useViewerCapabilities } from "./viewer-capabilities-context";

export type RoleGateProps = {
  roles?: readonly UserRole[];
  staffRoles?: readonly UserStaffRole[];
  children: ReactNode;
  fallback?: ReactNode;
};

export function RoleGate({ roles, staffRoles, children, fallback = null }: RoleGateProps) {
  const viewer = useViewerCapabilities();
  if (roles && !roles.includes(viewer.role)) return fallback;
  // Staff pass when any role they hold is one of the allowed ones.
  const held = viewer.staffRoles ?? [];
  if (staffRoles && viewer.role === "staff" && !held.some((r) => staffRoles.includes(r))) {
    return fallback;
  }
  return children;
}
