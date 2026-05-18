import type { CapabilityRequirement, UserRole, UserStaffRole } from "@auction/types";

export type ClientWorkspace = "buying" | "selling";

export type ActingContext =
  | { kind: "self" }
  | { kind: "organisation"; orgId: string; orgName: string }
  | { kind: "impersonating"; userId: string; userName: string };

export type ViewerWorkspace = ClientWorkspace | "staff" | "finance";

export type ViewerCapabilities = {
  role: UserRole;
  staffRole: UserStaffRole | null;
  workspace: ViewerWorkspace;
  acting: ActingContext;
  can: (requirement: CapabilityRequirement) => boolean;
};
