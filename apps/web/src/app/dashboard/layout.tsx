import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/?auth=required");
  }

  return (
    <div className="flex min-h-screen bg-surface font-body text-on-surface">
      <DashboardSidebar user={user} />
      <div className="min-h-screen flex-1 pl-64">
        <div id="main-content" className="px-8 py-12 md:px-20">
          {children}
        </div>
      </div>
    </div>
  );
}
