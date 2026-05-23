import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminSubmissionsLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(SUBMISSIONS_ACCESS, "/admin/submissions");
  return children;
}
