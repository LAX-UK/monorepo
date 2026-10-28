import { FINANCE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type StaffRoles, type UserRole, userHasAccessTo } from "@auction/types";

export type FinanceCapabilities = {
  canAccessFinance: boolean;
  canMutatePayments: boolean;
  canMutatePayouts: boolean;
};

export function resolveFinanceCapabilities(input: {
  role: UserRole;
  staffRoles: StaffRoles | undefined;
}): FinanceCapabilities {
  const canAccessFinance = userHasAccessTo(input.role, input.staffRoles, FINANCE_ACCESS);
  return {
    canAccessFinance,
    canMutatePayments: canAccessFinance,
    canMutatePayouts: canAccessFinance,
  };
}
