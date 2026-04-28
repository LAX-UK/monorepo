import { AdminBottomNav } from "@/components/layout/admin-bottom-nav";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getAdminSubmissionPendingCount } from "@/lib/data/http/submissions.server";
import {
  canAccessPlatformAdminRoutes,
  canAccessStaffAdminShell,
  type UserRole,
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

  return (
    <>
      <DashboardShell
        user={user}
        mobileTitle="Admin"
        accountMenu="admin"
        sidebar={<AdminSidebar user={user} pendingSubmissionCount={pendingSubmissionCount} />}
      >
        <div className="pb-20 lg:pb-0">{children}</div>
      </DashboardShell>
      <AdminBottomNav user={user} />
    </>
  );
}
