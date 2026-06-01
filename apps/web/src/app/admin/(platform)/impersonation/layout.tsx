import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { PLATFORM_ADMIN_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminImpersonationLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(PLATFORM_ADMIN_ACCESS, "/admin/impersonation");
  return children;
}
