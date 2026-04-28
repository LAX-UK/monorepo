import { canAccessPlatformAdminRoutes, type UserRole } from "@auction/types";
import type { ReactNode } from "react";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { redirect } from "next/navigation";

/** Full platform administration: sales, lots, users, submissions, analytics, invitations. */
export default async function AdminPlatformLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?next=/admin&auth=required");
  }
  if (!canAccessPlatformAdminRoutes(user.role as UserRole)) {
    redirect("/admin/payments");
  }
  return children;
}
