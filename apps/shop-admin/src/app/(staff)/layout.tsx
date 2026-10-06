export const dynamic = "force-dynamic";

import { ShopAdminShell } from "@/components/shop-admin-shell";
import { loadAdminSession } from "@/lib/admin-data.server";
import { buildAdminNavGroups } from "@/server/domain/admin-nav.vm";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const sessionResult = await loadAdminSession();
  if (sessionResult.status === "unauthorized") {
    redirect("/login");
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
