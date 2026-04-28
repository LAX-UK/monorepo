import { canAccessFinanceAdminRoutes, type UserRole } from "@auction/types";
import type { ReactNode } from "react";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { redirect } from "next/navigation";

/** Finance-only admin: payments and accounting integrations. */
export default async function AdminFinanceLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?next=/admin&auth=required");
  }
  if (!canAccessFinanceAdminRoutes(user.role as UserRole)) {
    redirect("/dashboard");
  }
  return children;
}
