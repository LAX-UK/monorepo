"use client";

import type { SessionUser } from "@/lib/data/contracts";
import {
  type CapabilityRequirement,
  type UserRole,
  type UserStaffRole,
  staffRoleToShellLayout,
  userHasAccessTo,
} from "@auction/types";
import { type ReactNode, createContext, useCallback, useContext, useMemo } from "react";
import type { ActingContext, ViewerCapabilities, ViewerWorkspace } from "./types";

const ViewerCapabilitiesContext = createContext<ViewerCapabilities | null>(null);

export type ViewerCapabilitiesProviderProps = {
  user: Pick<SessionUser, "role" | "staffRole" | "name">;
  acting?: ActingContext;
  children: ReactNode;
};

function resolveWorkspace(role: UserRole, staffRole: UserStaffRole | null): ViewerWorkspace {
  if (role === "client") return "client";
  const shell = staffRoleToShellLayout(role, staffRole);
  return shell === "finance" ? "finance" : "staff";
}

export function ViewerCapabilitiesProvider({
  user,
  acting = { kind: "self" },
  children,
}: ViewerCapabilitiesProviderProps) {
  const role = user.role as UserRole;
  const staffRole = (user.staffRole ?? null) as UserStaffRole | null;

  const can = useCallback(
    (requirement: CapabilityRequirement) => userHasAccessTo(role, staffRole, requirement),
    [role, staffRole],
  );

  const value = useMemo<ViewerCapabilities>(
    () => ({
      role,
      staffRole,
      workspace: resolveWorkspace(role, staffRole),
      acting,
      can,
    }),
    [role, staffRole, acting, can],
  );

  return (
    <ViewerCapabilitiesContext.Provider value={value}>
      {children}
    </ViewerCapabilitiesContext.Provider>
  );
}

export function useViewerCapabilities(): ViewerCapabilities {
  const ctx = useContext(ViewerCapabilitiesContext);
  if (!ctx) {
    throw new Error("useViewerCapabilities must be used within ViewerCapabilitiesProvider");
  }
  return ctx;
}
