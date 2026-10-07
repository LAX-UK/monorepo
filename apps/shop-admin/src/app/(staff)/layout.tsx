export const dynamic = "force-dynamic";

import { ShopAdminShell } from "@/components/shop-admin-shell";
import { loadAdminSession } from "@/lib/admin-data.server";
import { safeReturnTo } from "@/lib/safe-return-to";
import { SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE, SHOP_ADMIN_SESSION_COOKIE } from "@/lib/session-cookie";
import { buildAdminNavGroups } from "@/server/domain/admin-nav.vm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const sessionResult = await loadAdminSession();
  if (sessionResult.status === "unauthorized") {
    const cookieStore = await cookies();
    const hadLoginAttempt = cookieStore.get(SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE)?.value;
    cookieStore.delete(SHOP_ADMIN_SESSION_COOKIE);
    cookieStore.delete(SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE);
    if (hadLoginAttempt) {
      redirect("/login?error=not_authorized");
    }
    const pathname = (await headers()).get("x-shop-admin-pathname");
    const returnTo = safeReturnTo(pathname);
    redirect(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  if (sessionResult.status !== "ok") {
    throw new Error(`Admin session unavailable (${sessionResult.status})`);
  }
  const cookieStore = await cookies();
  cookieStore.delete(SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE);
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
