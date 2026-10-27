import { resolveAdminReturnPath } from "@/lib/admin/admin-return-path.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { adminDenialDestination } from "@/lib/navigation/admin-route-access";
import { type UserRole, canAccessFinanceAdminRoutes } from "@auction/types";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/** Finance-only admin: payments and accounting integrations. */
export default async function AdminFinanceLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  const requested = await resolveAdminReturnPath();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(requested)}&auth=required`);
  }
  const role = user.role as UserRole;
  if (!canAccessFinanceAdminRoutes(role, user.staffRole ?? null)) {
    redirect(role === "staff" ? adminDenialDestination(role, user.staffRole, requested) : "/home");
  }
  return children;
}
