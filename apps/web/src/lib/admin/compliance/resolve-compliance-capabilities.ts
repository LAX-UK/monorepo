import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, type UserStaffRole, userHasAccessTo } from "@auction/types";

export type ComplianceCapabilities = {
  canTriage: boolean;
  canDecide: boolean;
};

export function resolveComplianceCapabilities(input: {
  role: UserRole;
  staffRole: UserStaffRole | null;
}): ComplianceCapabilities {
  return {
    canTriage: userHasAccessTo(input.role, input.staffRole, AML_REVIEW_ACCESS),
    canDecide: userHasAccessTo(input.role, input.staffRole, MLRO_DECISION_ACCESS),
  };
}
