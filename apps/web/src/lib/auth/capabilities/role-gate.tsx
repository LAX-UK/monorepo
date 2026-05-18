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
  const { role, staffRole } = useViewerCapabilities();
  if (roles && !roles.includes(role)) return fallback;
  if (staffRoles && role === "staff" && staffRole && !staffRoles.includes(staffRole)) {
    return fallback;
  }
  if (staffRoles && role === "staff" && !staffRole) return fallback;
  return children;
}
