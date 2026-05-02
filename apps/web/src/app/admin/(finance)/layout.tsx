import { getServerSessionUser } from "@/lib/data/http/session.server";
import { type UserRole, canAccessFinanceAdminRoutes } from "@auction/types";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

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
