"use client";

import { StaffBulkOperations } from "@/components/admin/staff/staff-bulk-operations";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { ExportButton } from "@/components/exports/export-button";
import { getUserBulkOperations } from "@/lib/admin/bulk-ops/users";
import {
  CLIENT_IDENTITY_FILTERS,
  type ClientsListSearch,
  type ClientsStaffRow,
  clientsListHref,
  clientsSortHref,
  clientsSortState,
  clientsTeamViews,
} from "@/lib/admin/people/clients-staff-list.vm";
import { createSavedViewsPort } from "@/lib/admin/saved-views-port";
import {
  ActiveFilterChips,
  type DataColumn,
  DataTable,
  DataTableToolbar,
  DataViews,
  DensityToggle,
  DetailPanel,
  EmptyState,
  ErrorState,
  FilterMenu,
  KeyValueList,
  NoResultsState,
  PanelSection,
  StaffButton,
  StatusBadge,
  TablePagination,
  TableSearch,
  formatStaffDateTime,
  initialsOf,
  useSavedViews,
  useTableDensity,
} from "@auction/staff-ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export type ClientsStaffListProps = {
  rows: ClientsStaffRow[];
  search: ClientsListSearch;
  counts: { total: number; active: number; suspended: number };
  filterChips: Array<{ id: string; label: string; clearHref: string }>;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  canModerate: boolean;
  exportFilters: Record<string, unknown>;
  loadError: string | null;
  filtered: boolean;
};

function Person({ row }: { row: ClientsStaffRow }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-staff-neutral-bg text-staff-2xs font-semibold text-staff-neutral-fg"
      >
        {initialsOf(row.name)}
      </span>
      <Link
        href={row.href}
        className="staff-focus truncate rounded-staff-xs font-medium text-staff-fg hover:underline"
      >
        {row.name}
      </Link>
    </span>
  );
}

/**
 * Client accounts in the staff kit: views by account standing, search, identity and email
 * filters, server sorting, bulk suspend for roles that may moderate, and a quick view.
 */
export function ClientsStaffList(props: ClientsStaffListProps) {
  const { rows, search } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [density, setDensity] = useTableDensity("bid-clients");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const port = useMemo(() => createSavedViewsPort("bid-admin.clients"), []);
  const saved = useSavedViews("bid-admin.clients", port, {
    legacyStorageKey: "staff.views.bid-clients",
  });
  const teamViews = useMemo(() => clientsTeamViews(), []);
  const operations = useMemo(
    () => (props.canModerate ? getUserBulkOperations() : []),
    [props.canModerate],
  );
  const status = typeof search.status === "string" ? search.status : "";
  const kyc = typeof search.kycStatus === "string" ? search.kycStatus : "";
  const emailVerified = typeof search.emailVerified === "string" ? search.emailVerified : "";
  const currentQuery = clientsListHref(search, {}).split("?")[1] ?? "";
  const pick = (values: string[], current: string) =>
    values.find((value) => value !== current) ?? "";
  const open = rows.find((row) => row.id === openId) ?? null;

  const columns: DataColumn<ClientsStaffRow>[] = [
    {
      id: "name",
      header: "Name",
      mobile: "title",
      sortable: true,
      cell: (row) => <Person row={row} />,
    },
    {
      id: "email",
      header: "Email",
      mobile: "meta",
      hideBelow: "md",
      cell: (row) => (
        <span className="text-staff-muted">
          {row.email}
          {row.emailVerified ? "" : " · not verified"}
        </span>
      ),
    },
    {
      id: "identity",
      header: "Identity",
      width: "128px",
      hideBelow: "lg",
      cell: (row) => <StatusBadge tone={row.identity.tone}>{row.identity.label}</StatusBadge>,
    },
    {
      id: "account",
      header: "Account",
      width: "160px",
      mobile: "badge",
      cell: (row) => <StatusBadge tone={row.account.tone}>{row.account.label}</StatusBadge>,
    },
    {
      id: "joined",
      header: "Joined",
      width: "176px",
      numeric: true,
      sortable: true,
      mobile: "meta",
      cell: (row) => <span className="text-staff-muted">{formatStaffDateTime(row.joinedAt)}</span>,
    },
  ];

  const views = [
    {
      id: "all",
      label: "All",
      href: clientsListHref(search, { status: null }),
      count: props.counts.total,
    },
    {
      id: "active",
      label: "Active",
      href: clientsListHref(search, { status: "active" }),
      count: props.counts.active,
    },
    {
      id: "suspended",
      label: "Suspended",
      href: clientsListHref(search, { status: "suspended" }),
      count: props.counts.suspended,
    },
  ];

  return (
    <>
      <DataTable
        label="Clients"
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        density={density}
        loading={pending}
        onRowOpen={(row) => setOpenId(row.id)}
        activeRowId={openId}
        sort={clientsSortState(typeof search.sort === "string" ? search.sort : undefined)}
        onSortChange={(sort) => navigate(clientsSortHref(search, sort))}
        {...(operations.length > 0
          ? {
              selectedIds: selected,
              onSelectedIdsChange: setSelected,
              bulkNoun: { one: "client", other: "clients" },
              bulkActions: (chosen: ClientsStaffRow[]) => (
                <StaffBulkOperations
                  operations={operations}
                  selectedIds={chosen.map((row) => row.id)}
                  onClear={() => setSelected(new Set())}
                  noun={{ one: "client", other: "clients" }}
                />
              ),
            }
          : {})}
        toolbar={
          <DataTableToolbar
            views={
              <DataViews
                views={views}
                activeId={status || "all"}
                Link={ListLink}
                team={teamViews}
                saved={saved}
                savedHref={(view) => `/admin/clients?${view.query}`}
                currentQuery={currentQuery}
              />
            }
            search={
              <TableSearch
                key={typeof search.q === "string" ? search.q : ""}
                label="Search clients"
                placeholder="Name or email"
                value={typeof search.q === "string" ? search.q : ""}
                onSearch={(q) => navigate(clientsListHref(search, { q: q || null }))}
              />
            }
            filters={
              <>
                <FilterMenu
                  label="Identity"
                  options={CLIENT_IDENTITY_FILTERS}
                  selected={kyc ? [kyc] : []}
                  onChange={(values) =>
                    navigate(clientsListHref(search, { kycStatus: pick(values, kyc) || null }))
                  }
                />
                <FilterMenu
                  label="Email"
                  options={[
                    { value: "1", label: "Verified" },
                    { value: "0", label: "Not verified" },
                  ]}
                  selected={emailVerified ? [emailVerified] : []}
                  onChange={(values) =>
                    navigate(
                      clientsListHref(search, {
                        emailVerified: pick(values, emailVerified) || null,
                      }),
                    )
                  }
                />
              </>
            }
            activeFilters={
              <ActiveFilterChips
                filters={props.filterChips.map((chip) => ({
                  id: chip.id,
                  label: chip.label,
                  onRemove: () => navigate(chip.clearHref),
                }))}
                onClearAll={() => navigate("/admin/clients")}
              />
            }
            end={
              <>
                <ExportButton entityType="clients" filters={props.exportFilters} />
                <DensityToggle value={density} onChange={setDensity} />
              </>
            }
          />
        }
        error={
          props.loadError ? (
            <ErrorState
              title="Clients did not load"
              description={props.loadError}
              action={
                <StaffButton size="sm" onClick={() => navigate(clientsListHref(search, {}))}>
                  Try again
                </StaffButton>
              }
            />
          ) : undefined
        }
        empty={
          props.filtered ? (
            <NoResultsState
              title="No clients match"
              description="Try another name or email, or clear the filters."
              action={
                <StaffButton size="sm" onClick={() => navigate("/admin/clients")}>
                  Clear filters
                </StaffButton>
              }
            />
          ) : (
            <EmptyState
              title="No clients yet"
              description="Client accounts appear here once people sign up."
            />
          )
        }
        footer={
          props.pagination ? (
            <TablePagination
              summary={props.pagination.summary}
              prevHref={props.pagination.prevHref}
              nextHref={props.pagination.nextHref}
              Link={ListLink}
            />
          ) : null
        }
      />
      <DetailPanel
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        title={open?.name ?? "Client"}
        description={open?.email}
        status={
          open ? <StatusBadge tone={open.account.tone}>{open.account.label}</StatusBadge> : null
        }
        footer={
          open ? (
            <StaffButton asChild variant="primary" icon={<ArrowUpRight aria-hidden />}>
              <Link href={open.href}>Open client</Link>
            </StaffButton>
          ) : null
        }
      >
        {open ? (
          <PanelSection title="Account">
            <KeyValueList
              items={[
                {
                  label: "Email",
                  value: `${open.email}${open.emailVerified ? "" : " (not verified)"}`,
                  copyValue: open.email,
                },
                {
                  label: "Identity",
                  value: <StatusBadge tone={open.identity.tone}>{open.identity.label}</StatusBadge>,
                },
                { label: "Two-step", value: open.twoFactor ? "On" : "Off" },
                { label: "Signed up as", value: open.persona },
                { label: "Joined", value: formatStaffDateTime(open.joinedAt) },
                { label: "User ID", value: `${open.id.slice(0, 8)}…`, copyValue: open.id },
              ]}
            />
          </PanelSection>
        ) : null}
      </DetailPanel>
    </>
  );
}
