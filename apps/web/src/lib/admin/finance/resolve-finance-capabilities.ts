import { FINANCE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, type UserStaffRole, userHasAccessTo } from "@auction/types";

export type FinanceCapabilities = {
  canAccessFinance: boolean;
  canMutatePayments: boolean;
  canMutatePayouts: boolean;
};

export function resolveFinanceCapabilities(input: {
  role: UserRole;
  staffRole: UserStaffRole | null;
}): FinanceCapabilities {
  const canAccessFinance = userHasAccessTo(input.role, input.staffRole, FINANCE_ACCESS);
  return {
    canAccessFinance,
    canMutatePayments: canAccessFinance,
    canMutatePayouts: canAccessFinance,
  };
}
