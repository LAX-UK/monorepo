import { DashboardBottomNav } from "@/components/layout/dashboard-bottom-nav";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard · LAX" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?next=/dashboard&auth=required");
  }
  if (user.role === "admin") {
    redirect("/admin");
  }

  return (
    <>
      <DashboardShell
        user={user}
        mobileTitle="Dashboard"
        sidebar={<DashboardSidebar user={user} />}
      >
        <div className="pb-20 lg:pb-0">{children}</div>
      </DashboardShell>
      <DashboardBottomNav />
    </>
  );
}
