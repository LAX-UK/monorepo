import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { ARTIST_WRITE_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminArtistFormLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminCapability(ARTIST_WRITE_ACCESS, `/admin/artists/${id}/edit`);
  return children;
}
