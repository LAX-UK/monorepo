import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { CONVEYOR_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminConveyorLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(CONVEYOR_ACCESS, "/admin/conveyor");
  return children;
}
