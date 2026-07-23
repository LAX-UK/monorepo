import { sessionUserToShellRole } from "@/components/layout/app-shell-nav";
import type { SessionUser } from "@/lib/data/contracts";
import type { UserStaffRole } from "@auction/types";
import { userStaffRoles } from "@auction/types";

const STAFF_ROLE_LABELS: Record<UserStaffRole, string> = {
  super_admin: "Super admin",
  auction_manager: "Auction manager",
  catalogue_manager: "Catalogue manager",
  specialist: "Specialist",
  finance_ops: "Finance",
  operations_fulfilment: "Operations fulfilment",
  content_marketing: "Content & marketing",
  support_concierge: "Support concierge",
  staff_viewer: "Staff viewer",
  compliance_officer: "Compliance officer",
  client_advisor: "Client advisor",
  operations: "Operations",
};

/** Human-readable label for internal staff roles. */
export function staffRoleLabel(role: UserStaffRole | null | undefined): string {
  if (role == null) return "Default (legacy full)";
  return STAFF_ROLE_LABELS[role];
}

/** Role label for shell identity chrome (sidebar pill, account menu). */
export function shellRolePillLabel(user: Pick<SessionUser, "role" | "staffRole">): string {
  const shell = sessionUserToShellRole(user);
  if (shell === "client") return "Client";
  if (user.role === "staff" && user.staffRole) {
    return staffRoleLabel(user.staffRole as UserStaffRole);
  }
  return "Staff";
}

export const staffRoleFilterOptions: { value: UserStaffRole; label: string }[] = userStaffRoles.map(
  (value) => ({
    value,
    label: staffRoleLabel(value),
  }),
);
