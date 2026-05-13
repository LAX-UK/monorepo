import { getServerSessionUser } from "@/lib/data/http/session.server";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/** Full platform administration: sales, lots, users, submissions, analytics, invitations. */
export default async function AdminPlatformLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?next=/admin&auth=required");
  }
  if (!canAccessPlatformAdminRoutes(user.role as UserRole, user.staffRole ?? null)) {
    redirect("/admin/payments");
  }
  return children;
}
