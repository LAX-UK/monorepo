import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { STAFF_ROLES_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

/** Anyone who may see staff roles; the directory, a record and the access review each narrow it. */
export default async function AdminStaffLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(STAFF_ROLES_READ_ACCESS, "/admin/staff");
  return children;
}
