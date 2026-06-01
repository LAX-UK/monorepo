import { AdminClientsBoard } from "@/components/admin/admin-clients-board";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminUserPreviewProvider } from "@/components/admin/admin-user-preview-provider";
import { AdminUsersFilterToolbar } from "@/components/admin/admin-users-filter-toolbar";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { PeopleListShell } from "@/components/admin/people/people-list-shell";
import {
  AdminUserListBulkBar,
  PeopleClientsMobileCards,
} from "@/components/admin/people/people-users-mobile-cards";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { ExportButton } from "@/components/exports/export-button";
import { usersListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildUsersActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import {
  countUsersListActiveFilters,
  hasUsersListActiveFilters,
  parseUsersListFilters,
  usersListFiltersToExportFilters,
} from "@/lib/admin/users-list-query";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { PaginationFooter } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Clients",
  "Browse collector and seller accounts.",
);

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const query = usersListController.parseQuery({ ...sp, role: "client" });
  const listFilters = parseUsersListFilters({ ...sp, role: "client" });

  let rows: AdminUserRow[] = [];
  let total = 0;
  let loadError: string | null = null;

  try {
    const result = await usersListController.fetch({ ...query, role: "client" });
    rows = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load clients.";
  }

  const activeFilterChips = buildUsersActiveFilterChips("/admin/clients", sp, listFilters);
  const activeFilterCount = countUsersListActiveFilters(listFilters);
  const hasFilters = hasUsersListActiveFilters(listFilters);
  const activeOnPage = rows.filter((r) => !r.suspendedAt).length;
  const suspendedOnPage = rows.filter((r) => r.suspendedAt).length;

  const exportFilters = {
    role: "client" as const,
    ...usersListFiltersToExportFilters(listFilters),
  };

  const pagination =
    !loadError && total > 0 ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        total={total}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/clients", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/clients", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  return (
    <AdminUserPreviewProvider>
      <PeopleListShell
        title="Clients"
        description="Browse collector and seller accounts. Filter by verification, KYC, persona, activity dates, and more."
        hasFilters={hasFilters}
        resetHref="/admin/clients"
        bulkBar={<AdminUserListBulkBar />}
        mobileSummary={
          !loadError ? (
            <CatalogListMobileSummary
              metrics={[
                { id: "total", label: "Total clients", value: String(total) },
                { id: "page", label: "On this page", value: String(rows.length) },
                { id: "active", label: "Active", value: String(activeOnPage) },
                { id: "suspended", label: "Suspended", value: String(suspendedOnPage) },
              ]}
            />
          ) : null
        }
        kpiStrip={
          !loadError ? (
            <AdminListKpiStrip
              ariaLabel="Client summary"
              tiles={[
                { label: "Total clients", value: total, delta: `${rows.length} on this page` },
                { label: "Active", value: activeOnPage, delta: "On this page" },
                { label: "Suspended", value: suspendedOnPage, delta: "On this page" },
                {
                  label: "Verified email",
                  value: rows.filter((r) => r.emailVerified).length,
                  delta: "On this page",
                },
              ]}
            />
          ) : null
        }
        errorAlert={
          error || loadError ? (
            <AdminListAlert title="Could not load clients">{loadError ?? error}</AdminListAlert>
          ) : null
        }
        filters={
          !loadError ? (
            <AdminUsersFilterToolbar
              filterDefaults={listFilters}
              activeFilterCount={activeFilterCount}
              activeFilterChips={activeFilterChips}
              toolbarEnd={<ExportButton entityType="clients" filters={exportFilters} />}
            />
          ) : null
        }
        filtersSelfContained
        view={
          !loadError && rows.length > 0 ? (
            <AdminClientsBoard
              rows={rows}
              totalMatches={total}
              hasActiveFilters={hasFilters}
              externalMobileCards
            />
          ) : null
        }
        mobileCards={
          !loadError && rows.length > 0 ? <PeopleClientsMobileCards rows={rows} /> : null
        }
        empty={
          !loadError && rows.length === 0 ? (
            <FilterEmptyState
              entity="clients"
              segment="admin"
              hasActiveFilters={hasFilters}
              clearFiltersHref="/admin/clients"
              {...(!hasFilters
                ? {
                    description: "Client accounts will appear here once users sign up.",
                  }
                : {})}
            />
          ) : null
        }
        pagination={pagination}
      />
    </AdminUserPreviewProvider>
  );
}
