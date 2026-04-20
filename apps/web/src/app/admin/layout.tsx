import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getAdminSubmissionPendingCount } from "@/lib/data/http/submissions.server";
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
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  let pendingSubmissionCount = 0;
  try {
    pendingSubmissionCount = await getAdminSubmissionPendingCount();
  } catch {
    pendingSubmissionCount = 0;
  }

  return (
    <DashboardShell
      user={user}
      mobileTitle="Admin"
      accountMenu="admin"
      sidebar={<AdminSidebar user={user} pendingSubmissionCount={pendingSubmissionCount} />}
    >
      {children}
    </DashboardShell>
  );
}
