import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { CONDITION_REPORTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminConditionReportsLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(CONDITION_REPORTS_ACCESS, "/admin/condition-reports");
  return children;
}
