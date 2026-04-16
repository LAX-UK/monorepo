import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?next=/dashboard&auth=required");
  }

  return (
    <DashboardShell
      user={user}
      mobileTitle="Dashboard"
      renderSidebar={({ onNavigate, mobileOpen }) => (
        <DashboardSidebar user={user} onNavigate={onNavigate} mobileOpen={mobileOpen} />
      )}
    >
      {children}
    </DashboardShell>
  );
}
