import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { LOTS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminLotsLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(LOTS_READ_ACCESS, "/admin/lots");
  return children;
}
