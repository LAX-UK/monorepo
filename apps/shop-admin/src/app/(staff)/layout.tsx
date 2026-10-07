export const dynamic = "force-dynamic";

import { ShopAdminShell } from "@/components/shop-admin-shell";
import { loadAdminSession } from "@/lib/admin-data.server";
import { resolveStaffLayoutRedirect, staffReauthHref } from "@/lib/staff-layout-redirect";
import { buildAdminNavGroups } from "@/server/domain/admin-nav.vm";
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
  const staffLabel = `${session.role.replaceAll("_", " ")} · ${session.subject.slice(0, 8)}…`;
  return (
    <ShopAdminShell navGroups={navGroups} staffLabel={staffLabel}>
      {children}
    </ShopAdminShell>
  );
}
