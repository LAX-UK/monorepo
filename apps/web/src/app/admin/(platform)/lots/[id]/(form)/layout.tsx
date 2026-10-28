import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { LOTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

/** Creating and editing need the write rule; the surrounding pages also open read-only. */
export default async function AdminLotFormLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(LOTS_ACCESS, "/admin/lots");
  return children;
}
