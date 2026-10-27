import type { CapabilityRequirement, UserRole, UserStaffRole } from "@auction/types";

export type ActingContext =
  | { kind: "self" }
  | { kind: "organisation"; orgId: string; orgName: string }
  | { kind: "impersonating"; userId: string; userName: string };

/** Which shell the viewer is in: the client area, staff admin or finance. */
export type ViewerWorkspace = "client" | "staff" | "finance";

export type ViewerCapabilities = {
  role: UserRole;
  staffRole: UserStaffRole | null;
  workspace: ViewerWorkspace;
  acting: ActingContext;
  can: (requirement: CapabilityRequirement) => boolean;
};
