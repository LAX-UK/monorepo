import { AdminClientsBoard } from "@/components/admin/admin-clients-board";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { AdminUsersFilterToolbar } from "@/components/admin/admin-users-filter-toolbar";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { ExportButton } from "@/components/exports/export-button";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { usersListController } from "@/lib/admin/admin-list-controllers";
import { firstString } from "@/lib/admin/admin-list-params";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import { buildUsersActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import {
  countUsersListActiveFilters,
  hasUsersListActiveFilters,
  parseUsersListFilters,
  usersListFiltersToExportFilters,
} from "@/lib/admin/users-list-query";
import { getAdminClientsKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { PaginationFooter } from "@auction/ui";

function safelyDecodeQueryParam(value: string | string[] | undefined): string | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const periodDays = parseAdminKpiPeriod(firstString(sp.period));
  const error = safelyDecodeQueryParam(sp.error);
  const query = usersListController.parseQuery({ ...sp, role: "client" });
  const listFilters = parseUsersListFilters({ ...sp, role: "client" });

  let rows: AdminUserRow[] = [];
  let total = 0;
  let loadError: string | null = null;
  const clientTrend = await getAdminClientsKpiTrend(periodDays).catch(() => ({
    currentTotal: 0,
    priorTotal: 0,
    dailyCounts: [] as number[],
  }));

  try {
    const result = await usersListController.fetch({ ...query, role: "client" });
    rows = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load clients.";
  }

  const chip = (patch: Record<string, string | number | boolean | undefined | null | "">) =>
    buildListHref("/admin/clients", sp, { ...patch, offset: 0 });

  const statusChip = (
    <FilterChipRow
      label="Quick status"
      chips={[
        {
          id: "all",
          label: "All",
          href: chip({ status: false, suspended: false }),
          active: !listFilters.accountStatus && !listFilters.suspendedOnly,
        },
        {
          id: "active",
          label: "Active",
          href: chip({ status: "active", suspended: false }),
          active: listFilters.accountStatus === "active",
        },
        {
          id: "suspended",
          label: "Suspended",
          href: chip({ status: "suspended", suspended: false }),
          active: listFilters.accountStatus === "suspended" || Boolean(listFilters.suspendedOnly),
        },
      ]}
    />
  );

  const activeFilterChips = buildUsersActiveFilterChips("/admin/clients", sp, listFilters);
  const activeFilterCount = countUsersListActiveFilters(listFilters);
  const hasFilters = hasUsersListActiveFilters(listFilters);

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
    <AdminListPage
      title="Clients"
      description="Browse collector and seller accounts. Filter by verification, KYC, persona, activity dates, and more."
      hasFilters={hasFilters}
      resetHref="/admin/clients"
      kpiStrip={
        !loadError ? (
          <AdminTrendKpiBand
            ariaLabel="Client summary"
            tiles={[
              buildTrendKpiTile("New clients", clientTrend, periodDays, { emphasize: true }),
              {
                label: "Total clients",
                value: String(total),
                compareHint: `${rows.length} on this page`,
              },
              {
                label: "Active on page",
                value: String(rows.filter((r) => !r.suspendedAt).length),
                compareHint: `${rows.length} loaded`,
                deltaTone: "positive",
              },
              {
                label: "Suspended on page",
                value: String(rows.filter((r) => r.suspendedAt).length),
                compareHint: `${rows.length} loaded`,
                semanticTone: rows.some((r) => r.suspendedAt) ? "warning" : "default",
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
      chips={statusChip}
      listToolbarEnd={null}
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
      view={
        !loadError && rows.length > 0 ? (
          <AdminClientsBoard rows={rows} totalMatches={total} hasActiveFilters={hasFilters} />
        ) : null
      }
      empty={
        !loadError && rows.length === 0 ? (
          <AdminEmptyState
            title="No clients"
            description={
              hasFilters
                ? "Try a different search query or clear filters."
                : "Client accounts will appear here once users sign up."
            }
          />
        ) : null
      }
      pagination={pagination}
    />
  );
}
