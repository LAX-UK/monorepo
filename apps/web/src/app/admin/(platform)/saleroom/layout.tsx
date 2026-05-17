import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALEROOM_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminSaleroomLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(SALEROOM_ACCESS, "/admin/saleroom");
  return children;
}
