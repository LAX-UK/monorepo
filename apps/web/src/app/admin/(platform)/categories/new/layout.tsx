import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { CATEGORIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

/** Creating and editing need the write rule; the surrounding pages also open read-only. */
export default async function AdminNewCategoryLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(CATEGORIES_ACCESS, "/admin/categories/new");
  return children;
}
