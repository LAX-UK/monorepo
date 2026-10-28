import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { VENUES_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

/** Creating and editing need the write rule; the surrounding pages also open read-only. */
export default async function AdminNewVenueLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(VENUES_ACCESS, "/admin/venues/new");
  return children;
}
