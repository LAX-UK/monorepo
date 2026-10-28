import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type StaffRoles, type UserRole, userHasAccessTo } from "@auction/types";

export type ComplianceCapabilities = {
  canTriage: boolean;
  canDecide: boolean;
};

export function resolveComplianceCapabilities(input: {
  role: UserRole;
  staffRoles: StaffRoles | undefined;
}): ComplianceCapabilities {
  return {
    canTriage: userHasAccessTo(input.role, input.staffRoles, AML_REVIEW_ACCESS),
    canDecide: userHasAccessTo(input.role, input.staffRoles, MLRO_DECISION_ACCESS),
  };
}
