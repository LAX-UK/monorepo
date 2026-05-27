import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALE_CATALOG_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminSalesLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(SALE_CATALOG_ACCESS, "/admin/sales");
  return children;
}
