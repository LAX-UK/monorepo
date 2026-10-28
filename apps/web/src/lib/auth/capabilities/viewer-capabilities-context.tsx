"use client";

import type { SessionUser } from "@/lib/data/contracts";
import {
  type CapabilityRequirement,
  type StaffRoles,
  type UserRole,
  staffRoleToShellLayout,
  userHasAccessTo,
} from "@auction/types";
import { type ReactNode, createContext, useCallback, useContext, useMemo } from "react";
import type { ActingContext, ViewerCapabilities, ViewerWorkspace } from "./types";

const ViewerCapabilitiesContext = createContext<ViewerCapabilities | null>(null);

export type ViewerCapabilitiesProviderProps = {
  user: Pick<SessionUser, "role" | "staffRoles" | "name">;
  acting?: ActingContext;
  children: ReactNode;
};

function resolveWorkspace(role: UserRole, staffRoles: StaffRoles | undefined): ViewerWorkspace {
  if (role === "client") return "client";
  const shell = staffRoleToShellLayout(role, staffRoles);
  return shell === "finance" ? "finance" : "staff";
}

export function ViewerCapabilitiesProvider({
  user,
  acting = { kind: "self" },
  children,
}: ViewerCapabilitiesProviderProps) {
  const role = user.role as UserRole;
  const staffRoles = user.staffRoles;

  const can = useCallback(
    (requirement: CapabilityRequirement) => userHasAccessTo(role, staffRoles, requirement),
    [role, staffRoles],
  );

  const value = useMemo<ViewerCapabilities>(
    () => ({
      role,
      staffRoles,
      workspace: resolveWorkspace(role, staffRoles),
      acting,
      can,
    }),
    [role, staffRoles, acting, can],
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
