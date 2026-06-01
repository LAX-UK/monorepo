import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { ANALYTICS_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminAnalyticsLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(ANALYTICS_ACCESS, "/admin/analytics");
  return children;
}
