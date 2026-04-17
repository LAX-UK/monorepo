import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?next=/admin&auth=required");
  }
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <DashboardShell user={user} mobileTitle="Admin" sidebar={<AdminSidebar user={user} />}>
      {children}
    </DashboardShell>
  );
}
