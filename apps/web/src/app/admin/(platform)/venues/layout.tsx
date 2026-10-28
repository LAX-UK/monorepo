import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { VENUES_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminVenuesLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(VENUES_READ_ACCESS, "/admin/venues");
  return children;
}
