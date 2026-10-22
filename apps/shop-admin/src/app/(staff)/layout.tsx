export const dynamic = "force-dynamic";

import { AdminAccountMenu } from "@/components/admin-account-menu";
import { ShopAdminShell } from "@/components/shop-admin-shell.client";
import { loadAdminSession } from "@/lib/admin-data.server";
import { resolveStaffLayoutRedirect, staffReauthHref } from "@/lib/staff-layout-redirect";
import { buildAdminNavGroups } from "@/server/domain/admin-nav.vm";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const sessionResult = await loadAdminSession();
  const pathname = (await headers()).get("x-shop-admin-pathname");
  const decision = resolveStaffLayoutRedirect(sessionResult, pathname);

  if (decision.action === "reauth") {
    redirect(staffReauthHref(decision));
  }
  if (decision.action === "login_error") {
    redirect(`/login?error=${decision.error}`);
  }
  if (decision.action === "fail") {
    throw new Error(`Admin session unavailable (${decision.detail})`);
  }
  if (sessionResult.status !== "ok") {
    throw new Error(`Admin session unavailable (${sessionResult.status})`);
  }

  const session = sessionResult.data;
  const navGroups = buildAdminNavGroups({
    capabilities: session.capabilities,
    features: session.features,
  });
  return (
    <ShopAdminShell
      navGroups={navGroups}
      account={<AdminAccountMenu roleLabel={staffRoleLabel(session.role)} />}
    >
      {children}
    </ShopAdminShell>
  );
}
