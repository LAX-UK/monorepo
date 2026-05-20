import { AdminClientsBoard } from "@/components/admin/admin-clients-board";
import { AdminClientsSearchForm } from "@/components/admin/admin-clients-search-form";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListExportLink } from "@/components/admin/admin-list-export-link";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { usersListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import { getAdminClientsKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { PaginationFooter } from "@auction/ui";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    q?: string;
    suspended?: string;
    limit?: string;
    offset?: string;
    period?: string;
  }>;
}) {
  const sp = await searchParams;
  const periodDays = parseAdminKpiPeriod(sp.period);
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = usersListController.parseQuery({ ...sp, role: "client" });

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

  const suspendedOnly = query.suspendedOnly ?? false;
  const q = query.q ?? "";

  const activeOnPage = rows.filter((r) => !r.suspendedAt).length;
  const suspendedOnPage = rows.filter((r) => r.suspendedAt).length;
  const activePct = rows.length > 0 ? Math.round((activeOnPage / rows.length) * 100) : 0;

  const chip = (patch: Record<string, string | number | boolean | undefined | null | "">) =>
    buildListHref("/admin/clients", sp, { ...patch, offset: 0 });

  const suspendedChip = (
    <FilterChipRow
      label="Status"
      chips={[
        {
          id: "all",
          label: "All clients",
          href: chip({ suspended: false }),
          active: !suspendedOnly,
        },
        {
          id: "suspended",
          label: "Suspended only",
          href: suspendedOnly ? chip({ suspended: false }) : chip({ suspended: true }),
          active: suspendedOnly,
        },
      ]}
    />
  );

  const hasFilters = Boolean(q || suspendedOnly);

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
      description="Browse collector and seller accounts. Search by name or email, filter by suspension, and open a profile for activity and catalogue links."
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
                label: "Active",
                value: String(activeOnPage),
                compareHint: rows.length > 0 ? `${activePct}% on page` : "Current page",
                deltaTone: "positive",
              },
              {
                label: "Suspended",
                value: String(suspendedOnPage),
                compareHint: "Current page",
                semanticTone: suspendedOnPage > 0 ? "warning" : "default",
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
      chips={suspendedChip}
      listToolbarEnd={<AdminListExportLink />}
      filters={
        !loadError ? <AdminClientsSearchForm initialQ={q} suspendedOnly={suspendedOnly} /> : null
      }
      view={
        !loadError && rows.length > 0 ? (
          <AdminClientsBoard rows={rows} totalMatches={total} />
        ) : null
      }
      empty={
        !loadError && rows.length === 0 ? (
          <AdminEmptyState
            title="No clients"
            description="Try a different search query or clear filters."
          />
        ) : null
      }
      pagination={pagination}
    />
  );
}
