import { AppShell } from "@/components/layout/app-shell";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  type UserRole,
  canAccessPlatformAdminRoutes,
  canAccessStaffAdminShell,
} from "@auction/types";
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
  const role = user.role as UserRole;
  if (canAccessStaffAdminShell(role)) {
    redirect(canAccessPlatformAdminRoutes(role) ? "/admin" : "/admin/payments");
  }

  return (
    <AppShell user={user} shellRole="client">
      {children}
    </AppShell>
  );
}
