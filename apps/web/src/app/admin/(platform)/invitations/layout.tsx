import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { INVITATIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminInvitationsLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(INVITATIONS_ACCESS, "/admin/invitations");
  return children;
}
