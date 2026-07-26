import { AdminHubQuickLinks } from "@/components/admin/admin-hub-quick-links";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { StaffHubShell } from "@/components/admin/catalog/staff-hub-shell";
import { OnboardingIssuesBoardContainer } from "@/components/admin/onboarding-issues-board/container";
import {
  buildOnboardingIssuesListKpiTiles,
  buildOnboardingIssuesMobileMetrics,
} from "@/lib/admin/build-onboarding-issues-list-kpi-tiles";
import { loadAdminOnboardingIssuesListPage } from "@/lib/admin/load-onboarding-issues-list-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Onboarding issues",
  "Legal entities, artists, KYC, and documents awaiting staff review.",
);

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminOnboardingIssuesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const loaded = await loadAdminOnboardingIssuesListPage(sp);
  const {
    model,
    tab,
    rows,
    selected,
    queueSummary,
    lensSummary,
    total,
    loadError,
    pagination,
    previewDegraded,
  } = loaded;

  return (
    <StaffHubShell
      title="Onboarding issues"
      description="Verification items for entities, artists, KYC, and documents awaiting staff review."
      mobileSummary={
        !loadError && queueSummary.queueTotal > 0 ? (
          <CatalogListMobileSummary
            metrics={buildOnboardingIssuesMobileMetrics(lensSummary, tab)}
          />
        ) : null
      }
      kpiStrip={
        !loadError && queueSummary.queueTotal > 0 ? (
          <AdminTrendKpiBand
            ariaLabel="Onboarding issues summary"
            tiles={buildOnboardingIssuesListKpiTiles(lensSummary, tab)}
          />
        ) : null
      }
      errorAlert={
        loadError ? (
          <AdminListAlert title="Could not load onboarding issues">{loadError}</AdminListAlert>
        ) : undefined
      }
      empty={
        !loadError && queueSummary.queueTotal === 0 ? (
          <CatalogListEmptyState
            title="All onboarding issues resolved"
            description="No entities, artists, KYC sessions, or documents need attention right now."
          />
        ) : null
      }
      view={
        <div className="space-y-8">
          <AdminHubQuickLinks
            ariaLabel="Onboarding quick links"
            links={[
              { href: "/admin/legal-entities", label: "Legal entities" },
              { href: "/admin/invitations", label: "Invitations" },
              { href: "/admin/clients", label: "Clients" },
            ]}
          />
          {!loadError && queueSummary.queueTotal > 0 ? (
            <Suspense fallback={null}>
              <OnboardingIssuesBoardContainer
                tab={tab}
                rows={rows}
                selected={selected}
                selectedItemId={model.selectedItemId}
                summary={queueSummary}
                lensTotal={total}
                pagination={pagination}
                tabHrefs={model.tabHrefs}
                listReturnTarget={model.listReturnTarget}
                clearPreviewHref={model.buildItemHref(null)}
                previewDegraded={previewDegraded}
              />
            </Suspense>
          ) : null}
        </div>
      }
    />
  );
}
