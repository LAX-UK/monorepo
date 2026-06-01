import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminStaffBoard } from "@/components/admin/admin-staff-board";
import { AdminStaffFilterToolbar } from "@/components/admin/admin-staff-filter-toolbar";
import { AdminUserPreviewProvider } from "@/components/admin/admin-user-preview-provider";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { PeopleListShell } from "@/components/admin/people/people-list-shell";
import {
  AdminUserListBulkBar,
  PeopleStaffMobileCards,
} from "@/components/admin/people/people-users-mobile-cards";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { usersListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import {
  buildStaffActiveFilterChips,
  countStaffListActiveFilters,
  hasStaffListActiveFilters,
  parseStaffListFilters,
} from "@/lib/admin/staff-list-query";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserStaffRole } from "@auction/types";
import { PaginationFooter } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Staff",
  "Internal team directory and staff role management.",
);

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    q?: string;
    staffRole?: string;
    suspended?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const query = usersListController.parseQuery({ ...sp, role: "staff" });
  const listFilters = parseStaffListFilters(sp);

  let rows: AdminUserRow[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const result = await usersListController.fetch({ ...query, role: "staff" });
    rows = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load staff.";
  }

  const activeOnPage = rows.filter((r) => !r.suspendedAt).length;
  const suspendedOnPage = rows.filter((r) => r.suspendedAt).length;

  const roleCounts = new Map<string, number>();
  for (const r of rows) {
    const key = r.staffRole ?? "legacy";
    roleCounts.set(key, (roleCounts.get(key) ?? 0) + 1);
  }

  const roleBreakdownText =
    rows.length > 0
      ? [...roleCounts.entries()]
          .map(
            ([role, n]) =>
              `${staffRoleLabel(role === "legacy" ? null : (role as UserStaffRole))}: ${n}`,
          )
          .join(" · ")
      : null;

  const roleBreakdown =
    rows.length > 0 ? (
      <p
        key="staff-role-breakdown"
        className="mb-4 hidden font-body text-xs text-on-surface-variant lg:block"
      >
        On this page: {roleBreakdownText}
      </p>
    ) : null;

  const activeFilterChips = buildStaffActiveFilterChips("/admin/staff", sp, listFilters);
  const activeFilterCount = countStaffListActiveFilters(listFilters);
  const hasFilters = hasStaffListActiveFilters(listFilters);

  const pagination =
    !loadError && total > 0 ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        total={total}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/staff", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/staff", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  return (
    <AdminUserPreviewProvider>
      <PeopleListShell
        title="Staff"
        description="Internal team directory. Filter by staff role or suspension, and manage capabilities from each profile."
        hasFilters={hasFilters}
        resetHref="/admin/staff"
        bulkBar={<AdminUserListBulkBar />}
        filtersSelfContained
        mobileSummary={
          !loadError ? (
            <CatalogListMobileSummary
              metrics={[
                { id: "total", label: "Total staff", value: String(total) },
                { id: "page", label: "On this page", value: String(rows.length) },
                { id: "active", label: "Active", value: String(activeOnPage) },
                { id: "suspended", label: "Suspended", value: String(suspendedOnPage) },
              ]}
              {...(roleBreakdownText
                ? {
                    prefix: (
                      <p className="mb-2 w-full font-body text-xs text-on-surface-variant lg:hidden">
                        Roles: {roleBreakdownText}
                      </p>
                    ),
                  }
                : {})}
            />
          ) : null
        }
        kpiStrip={
          !loadError ? (
            <AdminListKpiStrip
              ariaLabel="Staff summary"
              tiles={[
                { label: "Total staff", value: total, delta: `${rows.length} on this page` },
                { label: "Active", value: activeOnPage, delta: "On this page" },
                { label: "Suspended", value: suspendedOnPage, delta: "On this page" },
                {
                  label: "Roles on page",
                  value: new Set(rows.map((r) => r.staffRole ?? "legacy")).size,
                  delta: "Distinct staff roles",
                },
              ]}
            />
          ) : null
        }
        errorAlert={
          error || loadError ? (
            <AdminListAlert title="Could not load staff">{loadError ?? error}</AdminListAlert>
          ) : null
        }
        filters={
          !loadError ? (
            <AdminStaffFilterToolbar
              activeFilterCount={activeFilterCount}
              activeFilterChips={activeFilterChips}
            />
          ) : null
        }
        view={
          !loadError && rows.length > 0 ? (
            <>
              {roleBreakdown}
              <AdminStaffBoard
                rows={rows}
                totalMatches={total}
                hasActiveFilters={hasFilters}
                externalMobileCards
              />
            </>
          ) : null
        }
        mobileCards={!loadError && rows.length > 0 ? <PeopleStaffMobileCards rows={rows} /> : null}
        empty={
          !loadError && rows.length === 0 ? (
            <FilterEmptyState
              entity="staff"
              segment="admin"
              hasActiveFilters={hasFilters}
              clearFiltersHref="/admin/staff"
            />
          ) : null
        }
        showCommandPaletteHint={!loadError && rows.length === 0}
        pagination={pagination}
      />
    </AdminUserPreviewProvider>
  );
}
