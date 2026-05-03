import { AppShell } from "@/components/layout/app-shell";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getAdminSubmissionPendingCount } from "@/lib/data/http/submissions.server";
import {
  type UserRole,
  canAccessPlatformAdminRoutes,
  canAccessStaffAdminShell,
} from "@auction/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · LAX" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?next=/admin&auth=required");
  }
  if (!canAccessStaffAdminShell(user.role as UserRole)) {
    redirect("/dashboard");
  }

  let pendingSubmissionCount = 0;
  if (canAccessPlatformAdminRoutes(user.role as UserRole)) {
    try {
      pendingSubmissionCount = await getAdminSubmissionPendingCount();
    } catch {
      pendingSubmissionCount = 0;
    }
  }

  const role = canAccessPlatformAdminRoutes(user.role as UserRole) ? "admin" : "accountant";

  return (
    <AppShell user={user} shellRole={role} pendingSubmissionCount={pendingSubmissionCount}>
      {children}
    </AppShell>
  );
}
