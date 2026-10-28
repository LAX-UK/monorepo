import { FinanceHub } from "@/components/admin/finance/finance-hub";
import { findStaffNavItemForPath } from "@/components/layout/staff-nav";
import { financeAttention, financeTools } from "@/lib/admin/finance/finance-hub.vm";
import { loadAdminFinanceHubPage } from "@/lib/admin/finance/load-finance-hub-page";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { canOpenAdminRoute } from "@/lib/navigation/admin-route-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserRole } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Finance",
  "Payments, payouts, disputes and accounting integrations.",
);

export default async function FinanceAdminHomePage() {
  const [user, { financeIssues, navCounts, failedPayouts, loadError }] = await Promise.all([
    getServerSessionUser(),
    loadAdminFinanceHubPage(),
  ]);
  // Only queues this person can open: a link to a page that would refuse them is a dead end.
  const canOpen = (href: string) =>
    user !== null &&
    canOpenAdminRoute(
      user.role as UserRole,
      user.staffRoles,
      href,
      findStaffNavItemForPath(href)?.requirement,
    );

  return (
    <FinanceHub
      attention={financeAttention(navCounts, financeIssues, failedPayouts).filter((item) =>
        canOpen(item.href),
      )}
      tools={financeTools(navCounts)}
      loadError={loadError}
    />
  );
}
