"use client";

import {
  type PersonActionTarget,
  usePersonActions,
} from "@/components/admin/people/use-person-actions";
import { StaffBulkOperations } from "@/components/admin/staff/staff-bulk-operations";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { ExportButton } from "@/components/exports/export-button";
import { getUserBulkOperations } from "@/lib/admin/bulk-ops/users";
import {
  CLIENT_EMAIL_FILTERS,
  CLIENT_IDENTITY_FILTERS,
  CLIENT_PERSONA_FILTERS,
  type ClientsListSearch,
  type ClientsStaffRow,
  clientPanelHref,
  clientsListHref,
  clientsSort,
  clientsSortHref,
  clientsTeamViews,
} from "@/lib/admin/people/clients-staff-list.vm";
import { createSavedViewsPort } from "@/lib/admin/saved-views-port";
import {
  type DataColumn,
  DataViews,
  DetailPanel,
  FilterSheet,
  ListPage,
  OverflowMenu,
  PersonCell,
  StaffButton,
  StaffDate,
  StatusBadge,
  TableSearch,
  formatStaffDateTime,
  staffButtonVariants,
  useSavedViews,
} from "@auction/staff-ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

export type ClientsStaffListProps = {
  rows: ClientsStaffRow[];
  search: ClientsListSearch;
  counts: { total: number; active: number; suspended: number };
  filterChips: Array<{ id: string; label: string; clearHref: string }>;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  canModerate: boolean;
  canManageRoles: boolean;
  exportFilters: Record<string, unknown>;
  loadError: string | null;
  filtered: boolean;
};

const str = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export function clientActionTarget(row: ClientsStaffRow): PersonActionTarget {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    staffRole: row.staffRole,
    suspended: row.suspended,
    twoFactorEnabled: row.twoFactor,
  };
}

const VIEW_EMPTY: Record<string, { title: string; description: string }> = {
  all: {
    title: "No clients yet",
    description: "Client accounts appear here once people sign up.",
  },
  active: {
    title: "No active clients",
    description: "Clients who can sign in, bid and buy appear here.",
  },
  suspended: {
    title: "No suspended clients",
    description: "When an account is suspended it appears here until it is unsuspended.",
  },
};

/**
 * Client accounts on the staff list template: views by account standing with counts, saved and
 * team views, search, a filter sheet for identity, email and sign-up type, server sorting (newest
 * first by default), bulk suspend for roles that may moderate, and a record panel deep-linked
 * with `?client=`. Every row's `…` menu holds the account actions, each confirmed first.
 */
export function ClientsStaffList(props: ClientsStaffListProps) {
  const { rows, search, filtered } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const panelHref = useCallback((id: string | null) => clientPanelHref(search, id), [search]);
  const panel = useListPanel({
    param: "client",
    initialId: str(search.client) || null,
    hrefFor: panelHref,
  });
  const person = usePersonActions({
    canModerate: props.canModerate,
    canManageRoles: props.canManageRoles,
  });
  const port = useMemo(() => createSavedViewsPort("bid-admin.clients"), []);
  const saved = useSavedViews("bid-admin.clients", port, {
    legacyStorageKey: "staff.views.bid-clients",
  });
  const teamViews = useMemo(() => clientsTeamViews(), []);
  const operations = useMemo(
    () => (props.canModerate ? getUserBulkOperations() : []),
    [props.canModerate],
  );
  const status = str(search.status);
  const currentQuery = clientsListHref(search, {}).split("?")[1] ?? "";
  const q = str(search.q);

  const columns = useMemo<DataColumn<ClientsStaffRow>[]>(
    () => [
      {
        id: "name",
        header: "Client",
        mobile: "title",
        sortable: true,
        defaultSortDirection: "asc",
        cell: (row) => (
          <PersonCell
            name={row.name}
            secondary={row.emailVerified ? row.email : `${row.email} · not verified`}
            href={panelHref(row.id)}
            Link={panel.PanelLink}
          />
        ),
      },
      {
        id: "account",
        header: "Account",
        width: "168px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.account.tone}>{row.account.label}</StatusBadge>,
      },
      {
        id: "identity",
        header: "Identity",
        width: "140px",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.identity.tone}>{row.identity.label}</StatusBadge>,
      },
      {
        id: "persona",
        header: "Signed up as",
        width: "136px",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.persona,
      },
      {
        id: "twoFactor",
        header: "Two-step",
        width: "104px",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => (row.twoFactor ? "On" : "Off"),
      },
      {
        id: "joined",
        header: "Joined",
        width: "128px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.joinedAt} />,
      },
    ],
    [panelHref, panel.PanelLink],
  );

  const views = [
    { id: "all", label: "All", status: null, count: props.counts.total },
    { id: "active", label: "Active", status: "active", count: props.counts.active },
    { id: "suspended", label: "Suspended", status: "suspended", count: props.counts.suspended },
  ].map((view) => ({
    id: view.id,
    label: view.label,
    href: clientsListHref(search, { status: view.status }),
    count: view.count,
  }));
  const activeView = status || "all";
  const clearHref = clientsListHref(search, {
    q: null,
    kycStatus: null,
    kycStatuses: null,
    emailVerified: null,
    persona: null,
    deletionRequested: null,
    hasMobile: null,
    createdFrom: null,
    createdTo: null,
    kycVerifiedFrom: null,
    kycVerifiedTo: null,
    suspended: null,
  });
  const open = rows.find((row) => row.id === panel.openId) ?? null;
  const openActions = open ? person.actionsFor(clientActionTarget(open)) : [];

  return (
    <>
      <ListPage<ClientsStaffRow>
        title="Clients"
        description="Collector and seller accounts. Open a client to see their activity, identity checks and account controls."
        Link={ListLink}
        listKey="bid-admin.clients"
        exportAction={
          <ExportButton
            entityType="clients"
            filters={props.exportFilters}
            className={staffButtonVariants({ variant: "secondary", size: "sm" })}
          />
        }
        views={
          <DataViews
            views={views}
            activeId={activeView}
            Link={ListLink}
            team={teamViews}
            saved={saved}
            savedHref={(view) => `/admin/clients?${view.query}`}
            currentQuery={currentQuery}
          />
        }
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search clients"
            placeholder="Search by name or email"
            value={q}
            onSearch={(next) => navigate(clientsListHref(search, { q: next || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter clients"
            sections={[
              {
                kind: "radio",
                id: "kycStatus",
                label: "Identity",
                anyLabel: "Any identity status",
                options: CLIENT_IDENTITY_FILTERS,
                value: str(search.kycStatus),
              },
              {
                kind: "radio",
                id: "emailVerified",
                label: "Email",
                anyLabel: "Verified or not",
                options: CLIENT_EMAIL_FILTERS,
                value: str(search.emailVerified),
              },
              {
                kind: "radio",
                id: "persona",
                label: "Signed up as",
                anyLabel: "Anyone",
                options: CLIENT_PERSONA_FILTERS,
                value: str(search.persona),
              },
              {
                kind: "date-range",
                id: "joined",
                label: "Joined",
                value: { from: str(search.createdFrom), to: str(search.createdTo) },
              },
            ]}
            onApply={(values) => {
              const joined = values.joined as { from: string; to: string };
              navigate(
                clientsListHref(search, {
                  kycStatus: (values.kycStatus as string) || null,
                  kycStatuses: null,
                  emailVerified: (values.emailVerified as string) || null,
                  persona: (values.persona as string) || null,
                  createdFrom: joined.from || null,
                  createdTo: joined.to || null,
                }),
              );
            }}
          />
        }
        activeFilters={props.filterChips.map((chip) => ({
          id: chip.id,
          label: chip.label,
          onRemove: () => navigate(chip.clearHref),
        }))}
        onClearFilters={() => navigate(clearHref)}
        loading={pending}
        filtered={filtered}
        error={
          props.loadError
            ? {
                title: "Clients did not load",
                description: props.loadError,
                onRetry: () => navigate(clientsListHref(search, {})),
              }
            : null
        }
        empty={VIEW_EMPTY[activeView] ?? (VIEW_EMPTY.all as { title: string; description: string })}
        noResults={{
          title: "No clients match",
          description: "Try another name or email, or clear the filters.",
        }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          // The client cell carries the email as a second line, which needs 44px rows.
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["twoFactor"],
          defaultSort: clientsSort.defaultSort,
          sort: clientsSort.state(str(search.sort)),
          onSortChange: (sort) => navigate(clientsSortHref(search, sort)),
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: panel.openId,
          ...(operations.length > 0
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
            : {}),
          rowActions: {
            label: (row) => `Actions for ${row.name}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.show(row.id) },
              { id: "page", label: "Open client page", href: row.href },
              ...person.actionsFor(clientActionTarget(row)),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(clientsListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <ClientQuickView row={open} actions={openActions} onClose={() => panel.show(null)} />
      {person.dialogs}
    </>
  );
}

/** The client's key facts beside the list, with their account actions and a way to their page. */
export function ClientQuickView({
  row,
  actions,
  onClose,
}: {
  row: ClientsStaffRow | null;
  actions: ReturnType<ReturnType<typeof usePersonActions>["actionsFor"]>;
  onClose: () => void;
}) {
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={row?.name ?? "Client"}
      status={
        row ? (
          <>
            <StatusBadge tone={row.account.tone}>{row.account.label}</StatusBadge>
            <StatusBadge tone={row.identity.tone}>{row.identity.label}</StatusBadge>
          </>
        ) : null
      }
      meta={
        row
          ? [{ label: "Joined", value: formatStaffDateTime(row.joinedAt, { zoneLabel: true }) }]
          : []
      }
      overflow={
        row && actions.length > 0 ? (
          <OverflowMenu label={`Account actions for ${row.name}`} actions={actions} />
        ) : null
      }
      summary={
        row
          ? [
              {
                label: "Email",
                value: row.emailVerified ? row.email : `${row.email} (not verified)`,
                copyValue: row.email,
              },
              { label: "Mobile", value: row.mobile ?? "Not given" },
              { label: "Signed up as", value: row.persona },
              { label: "Two-step", value: row.twoFactor ? "On" : "Off" },
              {
                label: "Identity verified",
                value: row.identityVerifiedAt
                  ? formatStaffDateTime(row.identityVerifiedAt, { zoneLabel: true })
                  : "Not yet",
              },
              { label: "User ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
      footer={
        row ? (
          <StaffButton asChild variant="primary" icon={<ArrowUpRight aria-hidden />}>
            <Link href={row.href}>Open client page</Link>
          </StaffButton>
        ) : null
      }
    >
      {null}
    </DetailPanel>
  );
}
