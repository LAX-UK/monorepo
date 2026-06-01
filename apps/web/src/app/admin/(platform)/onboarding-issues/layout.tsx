import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { ONBOARDING_QUEUES_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminOnboardingIssuesLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(ONBOARDING_QUEUES_ACCESS, "/admin/onboarding-issues");
  return children;
}
