import {
  AdminBulkSelectionBar,
  AdminBulkSelectionProvider,
} from "@/components/admin/admin-bulk-selection-bridge";
import { AdminInvitationsBoard } from "@/components/admin/admin-invitations-board";
import { AdminInviteForm } from "@/components/admin/admin-invite-form";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { InvitationsFilterToolbar } from "@/components/admin/invitations-filter-toolbar";
import { InvitationsMobileCards } from "@/components/admin/people/invitations-mobile-cards";
import { PeopleListShell } from "@/components/admin/people/people-list-shell";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { invitationsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import {
  buildInvitationsActiveFilterChips,
  countInvitationsListActiveFilters,
  hasInvitationsListActiveFilters,
  parseInvitationsListFilters,
} from "@/lib/admin/invitations-list-query";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminInvitationsPage } from "@/lib/data/http/invitations.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Surface } from "@auction/ui/components/surface";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Invitations",
  "Invite staff or clients by email.",
);

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    q?: string;
    status?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const query = invitationsListController.parseQuery(sp);
  const listFilters = parseInvitationsListFilters(sp);
  const activeFilterChips = buildInvitationsActiveFilterChips(
    "/admin/invitations",
    sp,
    listFilters,
  );
  const activeFilterCount = countInvitationsListActiveFilters(listFilters);
  const hasFilters = hasInvitationsListActiveFilters(listFilters);

  let rows: Awaited<ReturnType<typeof invitationsListController.fetch>>["rows"] = [];
  let total = 0;
  let pendingTotal = 0;
  let acceptedTotal = 0;
  let loadError: string | null = null;
  try {
    const result = await getAdminInvitationsPage({
      offset: query.offset,
      limit: query.limit,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { q: query.q } : {}),
    });
    rows = result.rows;
    total = result.total ?? 0;
    pendingTotal = result.pendingTotal;
    acceptedTotal = result.acceptedTotal;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load invitations.";
  }

  const isPaginationEmpty = !loadError && total > 0 && rows.length === 0 && !hasFilters;

  const pagination =
    !loadError && total > 0 ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        total={total}
        countOnPage={rows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/invitations", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/invitations", sp, { offset: query.offset + query.limit })
            : null
        }
      />
    ) : null;

  return (
    <AdminBulkSelectionProvider>
      <PeopleListShell
        title="Invitations"
        description="Invite staff or clients by email. They complete signup using the link we send."
        hasFilters={hasFilters}
        resetHref="/admin/invitations"
        bulkBar={<AdminBulkSelectionBar />}
        headerAfter={
          !loadError ? (
            <div className="space-y-8">
              <Surface variant="card" className="border-border-hairline">
                <div className="space-y-1">
                  <h2 className="font-headline text-lg text-on-surface">Send invite</h2>
                  <p className="text-sm text-on-surface-variant">
                    They&apos;ll receive an email with a secure signup link that expires in 7 days.
                    Paste multiple emails separated by commas to invite a batch at once.
                  </p>
                </div>
                <AdminInviteForm />
              </Surface>
              <div className="space-y-1">
                <h2 className="font-headline text-lg text-on-surface">Sent invitations</h2>
                <p className="text-sm text-on-surface-variant">
                  {total > 0
                    ? `${total} invitation${total === 1 ? "" : "s"}${hasFilters ? " matching filters" : " total"}`
                    : "All platform invitations"}
                </p>
              </div>
            </div>
          ) : null
        }
        kpiStrip={
          !loadError ? (
            <AdminListKpiStrip
              ariaLabel="Invitations summary"
              tiles={[
                {
                  label: "Total invitations",
                  value: total,
                  delta: hasFilters
                    ? `${rows.length} matching filters`
                    : `${rows.length} on this page`,
                },
                { label: "Pending", value: pendingTotal, delta: "Org-wide" },
                { label: "Accepted", value: acceptedTotal, delta: "Org-wide" },
              ]}
            />
          ) : null
        }
        mobileSummary={
          !loadError ? (
            <CatalogListMobileSummary
              metrics={[
                { id: "total", label: "Total invitations", value: String(total) },
                { id: "pending", label: "Pending", value: String(pendingTotal) },
                { id: "accepted", label: "Accepted", value: String(acceptedTotal) },
              ]}
            />
          ) : null
        }
        errorAlert={
          error || loadError ? (
            <AdminListAlert title="Could not load invitations">{loadError ?? error}</AdminListAlert>
          ) : null
        }
        filters={
          !loadError ? (
            <InvitationsFilterToolbar
              activeFilterCount={activeFilterCount}
              activeFilterChips={activeFilterChips}
            />
          ) : null
        }
        filtersSelfContained
        view={
          !loadError && rows.length > 0 ? (
            <AdminInvitationsBoard rows={rows} externalMobileCards />
          ) : null
        }
        mobileCards={!loadError && rows.length > 0 ? <InvitationsMobileCards rows={rows} /> : null}
        empty={
          !loadError && rows.length === 0 ? (
            <FilterEmptyState
              entity="invitations"
              segment="admin"
              hasActiveFilters={hasFilters}
              clearFiltersHref="/admin/invitations"
              {...(isPaginationEmpty
                ? {
                    title: "No invitations on this page",
                    description: "Try a previous page or adjust pagination.",
                  }
                : !hasFilters
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
        pagination={pagination}
      />
    </AdminBulkSelectionProvider>
  );
}
