import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { LOT_FULFILMENT_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminLotFulfilmentLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(LOT_FULFILMENT_ACCESS, "/admin/lot-fulfilment");
  return children;
}
