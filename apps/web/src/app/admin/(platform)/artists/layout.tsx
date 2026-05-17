import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { ARTISTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminArtistsLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(ARTISTS_ACCESS, "/admin/artists");
  return children;
}
