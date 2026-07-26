import {
  AdminBulkSelectionBar,
  AdminBulkSelectionProvider,
} from "@/components/admin/admin-bulk-selection-bridge";
import { AdminInvitationsBoardContainer } from "@/components/admin/admin-invitations-board-container";
import { AdminInviteCard } from "@/components/admin/admin-invite-card";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListPreviewDegradedAlert } from "@/components/admin/admin-list-preview-degraded-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { InvitationsFilterToolbar } from "@/components/admin/invitations-filter-toolbar";
import { InvitationsListPagination } from "@/components/admin/invitations-list-pagination";
import { InvitationsMobileCards } from "@/components/admin/people/invitations-mobile-cards";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import {
  buildInvitationsListKpiTiles,
  buildInvitationsMobileMetrics,
} from "@/lib/admin/people/build-invitations-list-kpi-tiles";
import { loadAdminInvitationsListPage } from "@/lib/admin/people/load-invitations-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { ADMIN_PEOPLE_LIST_HEADING_ID } from "@/lib/admin/use-admin-list-preview-return-focus";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Invitations",
  "Invite staff or clients by email.",
);

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const {
    model,
    rows,
    summary,
    total,
    loadError,
    dehydratedState,
    pagination,
    selectedInvitation,
    previewDegraded,
  } = await loadAdminInvitationsListPage(sp);

  const isPaginationEmpty = !loadError && total > 0 && rows.length === 0 && !model.hasFilters;

  return (
    <AdminBulkSelectionProvider>
      <CatalogListShell
        title="Invitations"
        listHeadingId={ADMIN_PEOPLE_LIST_HEADING_ID}
        description="Invite staff or clients by email. They complete signup using the link we send."
        hasFilters={model.hasFilters}
        resetHref={model.basePath}
        bulkBar={<AdminBulkSelectionBar />}
        headerAfter={
          !loadError ? (
            <div className="space-y-6">
              <AdminInviteCard />
              <div className="space-y-1 pt-2">
                <h2 className="font-headline text-lg text-on-surface">Sent invitations</h2>
                <p className="text-sm text-on-surface-variant">
                  {total > 0
                    ? `${total} invitation${total === 1 ? "" : "s"}${model.hasFilters ? " matching filters" : " total"}`
                    : "All platform invitations"}
                </p>
              </div>
            </div>
          ) : null
        }
        kpiStrip={
          !loadError ? (
            <AdminTrendKpiBand
              ariaLabel="Invitations summary"
              tiles={buildInvitationsListKpiTiles(summary)}
            />
          ) : null
        }
        mobileSummary={
          !loadError ? (
            <CatalogListMobileSummary metrics={buildInvitationsMobileMetrics(summary)} />
          ) : null
        }
        errorAlert={
          error || loadError ? (
            <AdminListAlert title="Could not load invitations">{loadError ?? error}</AdminListAlert>
          ) : previewDegraded ? (
            <AdminListPreviewDegradedAlert
              entityLabel="invitation"
              clearHref={model.buildDrawerHref(null)}
            />
          ) : null
        }
        filters={
          !loadError ? (
            <InvitationsFilterToolbar
              activeFilterCount={model.activeFilterCount}
              activeFilterChips={model.activeFilterChips}
            />
          ) : null
        }
        filtersSelfContained
        mobileCards={!loadError && rows.length > 0 ? <InvitationsMobileCards rows={rows} /> : null}
        empty={
          !loadError && rows.length === 0 ? (
            <FilterEmptyState
              entity="invitations"
              segment="admin"
              hasActiveFilters={model.hasFilters}
              clearFiltersHref={model.basePath}
              {...(isPaginationEmpty
                ? {
                    title: "No invitations on this page",
                    description: "Try a previous page or adjust pagination.",
                  }
                : !model.hasFilters
                  ? {
                      title: "No invitations yet",
                      description:
                        "Send an invite above — pending invitations will appear in this list.",
                      illustration: "queue" as const,
                    }
                  : {})}
            />
          ) : null
        }
        pagination={
          pagination ? (
            <InvitationsListPagination
              offset={pagination.offset}
              limit={pagination.limit}
              total={pagination.total}
              countOnPage={pagination.countOnPage}
            />
          ) : null
        }
      >
        {!loadError && (rows.length > 0 || selectedInvitation) && dehydratedState ? (
          <HydrationBoundary state={dehydratedState}>
            <AdminInvitationsBoardContainer
              params={model.listQueryParams}
              externalMobileCards
              selectedInvitationId={model.selectedInvitationId}
              selectedInvitation={selectedInvitation}
            />
          </HydrationBoundary>
        ) : !loadError && selectedInvitation ? (
          <AdminInvitationsBoardContainer
            params={model.listQueryParams}
            externalMobileCards
            selectedInvitationId={model.selectedInvitationId}
            selectedInvitation={selectedInvitation}
          />
        ) : null}
      </CatalogListShell>
    </AdminBulkSelectionProvider>
  );
}
