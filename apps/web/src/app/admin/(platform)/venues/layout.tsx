import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { VENUES_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminVenuesLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(VENUES_ACCESS, "/admin/venues");
  return children;
}
