import { AdminHubQuickLinks } from "@/components/admin/admin-hub-quick-links";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { XeroIntegrationPanel } from "@/components/admin/xero-integration-panel";
import { adminXeroDisconnectAction, adminXeroOAuthStartAction } from "@/lib/actions/admin";
import { mapFinanceHubQuickLinks } from "@/lib/admin/finance-hub-links";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getFinanceAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminXeroIntegrationStatus } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Xero integration",
  "Connect a Xero organisation for hosted invoices and payment collection.",
);

export default async function AdminXeroIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const connected = sp.connected === "1";

  let status: Awaited<ReturnType<typeof getAdminXeroIntegrationStatus>> | null = null;
  let loadError: string | null = null;
  try {
    status = await getAdminXeroIntegrationStatus();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load Xero status.";
  }

  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  try {
    navCounts = await getFinanceAdminNavCounts();
  } catch {
    /* use empty */
  }

  return (
    <AdminListShell
      layout="hub"
      className="max-w-[640px]"
      title="Xero"
      description="Connect your Xero organisation for hosted invoices and payment collection."
      breadcrumbs={
        <Link
          href="/admin/finance"
          className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← Finance
        </Link>
      }
      mobileSummary={
        <CatalogListMobileSummary
          metrics={[
            {
              id: "manual-review",
              label: "Manual review",
              value: String(navCounts.manualReviewCount),
            },
            { id: "disputes", label: "Open disputes", value: String(navCounts.disputesOpen) },
            { id: "payouts", label: "Failed payouts", value: String(navCounts.payoutsFailed) },
          ]}
        />
      }
      view={
        <div className="space-y-8">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {connected && !error ? (
            <Alert>
              <AlertTitle>Connected</AlertTitle>
              <AlertDescription>Xero authorisation completed.</AlertDescription>
            </Alert>
          ) : null}

          {loadError ? (
            <AdminListAlert title="Could not load status">{loadError}</AdminListAlert>
          ) : null}

          {status ? (
            <XeroIntegrationPanel
              status={status}
              oauthStartAction={adminXeroOAuthStartAction}
              disconnectAction={adminXeroDisconnectAction}
            />
          ) : null}

          <AdminHubQuickLinks
            ariaLabel="Finance quick links"
            links={mapFinanceHubQuickLinks(navCounts)}
          />
        </div>
      }
    />
  );
}
