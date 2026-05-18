import { AdminClientsBoard } from "@/components/admin/admin-clients-board";
import { AdminClientsSearchForm } from "@/components/admin/admin-clients-search-form";
import { AdminListPage } from "@/components/admin/admin-list-page";
import type { AdminUserListKpi } from "@/components/admin/admin-user-list-shell";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { usersListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { countCreatedWithinDays } from "@/lib/admin/format-admin-user-date";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    q?: string;
    suspended?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = usersListController.parseQuery({ ...sp, role: "client" });

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

  const suspendedOnly = query.suspendedOnly ?? false;
  const q = query.q ?? "";

  const activeOnPage = rows.filter((r) => !r.suspendedAt).length;
  const suspendedOnPage = rows.filter((r) => r.suspendedAt).length;
  const new30dOnPage = countCreatedWithinDays(rows, 30);

  const activePct = rows.length > 0 ? Math.round((activeOnPage / rows.length) * 100) : 0;

  const kpis: AdminUserListKpi[] = [
    { label: "Total clients", value: total, delta: `${rows.length} on page` },
    {
      label: "Active",
      value: activeOnPage,
      delta: rows.length > 0 ? `${activePct}% on page` : "Current page",
      deltaTone: "positive",
    },
    {
      label: "Suspended",
      value: suspendedOnPage,
      delta: "Current page",
      deltaTone: suspendedOnPage > 0 ? "negative" : "neutral",
      semanticTone: suspendedOnPage > 0 ? "warning" : "default",
    },
    { label: "New (30d)", value: new30dOnPage, delta: "Current page" },
  ];

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
      errorAlert={
        error || loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load clients</AlertTitle>
            <AlertDescription>{loadError ?? error}</AlertDescription>
          </Alert>
        ) : null
      }
      chips={suspendedChip}
      filters={
        !loadError ? <AdminClientsSearchForm initialQ={q} suspendedOnly={suspendedOnly} /> : null
      }
      view={
        !loadError && rows.length > 0 ? (
          <AdminClientsBoard rows={rows} totalMatches={total} kpis={kpis} />
        ) : null
      }
      empty={
        !loadError && rows.length === 0 ? (
          <EmptyState
            title="No clients"
            description="Try a different search query or clear filters."
          />
        ) : null
      }
      pagination={pagination}
    />
  );
}
