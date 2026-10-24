export const dynamic = "force-dynamic";

import { ShopAdminShell } from "@/components/shop-admin-shell.client";
import { loadAdminSession } from "@/lib/admin-data.server";
import { resolveStaffLayoutRedirect, staffSignInHref } from "@/lib/staff-layout-redirect";
import { loadEnquirySummary } from "@/server/application/load-enquiry-summary";
import { loadStaffIdentity } from "@/server/application/load-staff-identity";
import { loadStaffProducts } from "@/server/application/load-staff-products";
import { buildAdminNavGroups } from "@/server/domain/admin-nav.vm";
import { staffDisplayName } from "@/server/domain/staff-identity.vm";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import {
  STAFF_NAV_COOKIE,
  STAFF_THEME_COOKIE,
  StaffToaster,
  parseStaffTheme,
} from "@auction/staff-ui";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const sessionResult = await loadAdminSession();
  const pathname = (await headers()).get("x-shop-admin-pathname");
  const decision = resolveStaffLayoutRedirect(sessionResult, pathname);

  if (decision.action === "reauth") {
    redirect(staffSignInHref(decision));
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
  const [enquirySummary, identity, products, jar] = await Promise.all([
    loadEnquirySummary(session.capabilities),
    loadStaffIdentity(),
    loadStaffProducts(),
    cookies(),
  ]);
  const navGroups = buildAdminNavGroups({
    capabilities: session.capabilities,
    features: session.features,
    enquiryAttentionCount: enquirySummary?.needsAttentionCount ?? 0,
  });
  const roleLabel = staffRoleLabel(session.role);
  return (
    <>
      <ShopAdminShell
        navGroups={navGroups}
        products={products}
        user={{
          name: staffDisplayName(identity, roleLabel),
          ...(identity.email ? { email: identity.email } : {}),
          roleLabel,
        }}
        initialTheme={parseStaffTheme(jar.get(STAFF_THEME_COOKIE)?.value)}
        defaultCollapsed={jar.get(STAFF_NAV_COOKIE)?.value === "collapsed"}
      >
        {children}
      </ShopAdminShell>
      <StaffToaster />
    </>
  );
}
