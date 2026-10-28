import { resolveAdminReturnPath } from "@/lib/admin/admin-return-path.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { adminDenialDestination } from "@/lib/navigation/admin-route-access";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/** Full platform administration: sales, lots, users, submissions, analytics, invitations. */
export default async function AdminPlatformLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  const requested = await resolveAdminReturnPath();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(requested)}&auth=required`);
  }
  const role = user.role as UserRole;
  if (!canAccessPlatformAdminRoutes(role, user.staffRoles)) {
    redirect(adminDenialDestination(role, user.staffRoles, requested));
  }
  return children;
}
