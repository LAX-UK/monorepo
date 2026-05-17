import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { CATEGORIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminCategoriesLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(CATEGORIES_ACCESS, "/admin/categories");
  return children;
}
