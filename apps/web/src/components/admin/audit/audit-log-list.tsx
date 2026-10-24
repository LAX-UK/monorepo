"use client";

import { AuditEventPanel } from "@/components/admin/audit/audit-event-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { searchAuditActorsAction } from "@/lib/actions/admin-audit-actors";
import type { AuditActionOption } from "@/lib/admin/audit/audit-action-options";
import {
  AUDIT_LOG_PATH,
  type AuditFilterChip,
  type AuditLogFilters,
  type AuditLogSearch,
  auditLogHref,
} from "@/lib/admin/audit/audit-log-search";
import {
  AUDIT_ENTITY_TYPES,
  type AuditLogRowModel,
  auditEntityTypeLabel,
} from "@/lib/admin/audit/audit-log.vm";
import {
  ActiveFilterChips,
  type DataColumn,
  DataTable,
  DataTableToolbar,
  DataViews,
  DateRangeFilter,
  DensityToggle,
  EmptyState,
  type EntityOption,
  EntityPicker,
  ErrorState,
  FilterMenu,
  NoResultsState,
  StaffButton,
  StatusBadge,
  TablePagination,
  TableSearch,
  formatStaffDateTime,
  initialsOf,
  useTableDensity,
} from "@auction/staff-ui";
import Link from "next/link";
import { useMemo, useState } from "react";

export type AuditLogListProps = {
  rows: AuditLogRowModel[];
  search: AuditLogSearch;
  filters: AuditLogFilters;
  chips: AuditFilterChip[];
  /** The log with every filter cleared, keeping the chosen view. */
  clearAllHref: string;
  actions: AuditActionOption[];
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
  filtered: boolean;
};

const VIEWS = [
  { id: "all", label: "All", view: null },
  { id: "finance", label: "Finance", view: "finance" },
  { id: "catalogue", label: "Catalogue", view: "catalogue" },
  { id: "people", label: "People", view: "people" },
] as const;

/** Module-level so the picker does not search again each time the list re-renders. */
async function searchActors(query: string): Promise<EntityOption[]> {
  const result = await searchAuditActorsAction(query);
  if (!result.ok) throw new Error(result.error);
  return (result.data?.actors ?? []).map((actor) => ({
    id: actor.userId,
    label: actor.name || actor.email,
    description: actor.email,
  }));
}

function Actor({ row }: { row: AuditLogRowModel }) {
  const system = row.actor.kind === "system";
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-staff-neutral-bg text-staff-2xs font-semibold text-staff-neutral-fg"
      >
        {system ? "S" : initialsOf(row.actor.name)}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-medium text-staff-fg">{row.actor.name}</span>
        {row.actor.email ? (
          <span className="truncate text-staff-xs text-staff-muted">{row.actor.email}</span>
        ) : null}
      </span>
    </span>
  );
}

function Entity({ row }: { row: AuditLogRowModel }) {
  const { entity } = row;
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="truncate text-staff-fg">{entity.typeLabel}</span>
      {entity.href ? (
        <Link
          href={entity.href}
          onClick={(event) => event.stopPropagation()}
          className="staff-focus w-fit truncate rounded-staff-xs text-staff-xs text-staff-muted underline-offset-2 hover:text-staff-fg hover:underline"
        >
          {entity.shortId}…
        </Link>
      ) : (
        <span className="truncate text-staff-xs text-staff-muted">{entity.shortId}…</span>
      )}
    </span>
  );
}

/**
 * The global audit log in the staff kit: views by area, search, actor, record type, action and
 * date filters held in the URL, server paging, and a panel with the full event.
 */
export function AuditLogList(props: AuditLogListProps) {
  const { rows, search, filters } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [density, setDensity] = useTableDensity("bid-audit");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((row) => row.id === openId) ?? null;
  const actionOptions = useMemo<EntityOption[]>(
    () =>
      props.actions.map((action) => ({
        id: action.value,
        label: action.label,
        description: action.value,
      })),
    [props.actions],
  );

  const columns: DataColumn<AuditLogRowModel>[] = [
    {
      id: "when",
      header: "Time",
      width: "176px",
      numeric: true,
      mobile: "meta",
      cell: (row) => <span className="text-staff-muted">{formatStaffDateTime(row.at)}</span>,
    },
    {
      id: "actor",
      header: "Actor",
      width: "232px",
      mobile: "meta",
      cell: (row) => <Actor row={row} />,
    },
    {
      id: "action",
      header: "Action",
      width: "264px",
      mobile: "title",
      cell: (row) => <StatusBadge tone={row.tone}>{row.action}</StatusBadge>,
    },
    {
      id: "entity",
      header: "Record",
      width: "148px",
      hideBelow: "md",
      cell: (row) => <Entity row={row} />,
    },
    {
      id: "summary",
      header: "Summary",
      hideBelow: "lg",
      mobile: "hidden",
      cell: (row) => <span className="line-clamp-2 text-staff-muted">{row.summary}</span>,
    },
  ];

  return (
    <>
      <DataTable
        label="Audit log"
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        density={density}
        loading={pending}
        onRowOpen={(row) => setOpenId(row.id)}
        activeRowId={openId}
        toolbar={
          <DataTableToolbar
            views={
              <DataViews
                views={VIEWS.map((view) => ({
                  id: view.id,
                  label: view.label,
                  href: auditLogHref(search, { view: view.view }),
                }))}
                activeId={filters.view ?? "all"}
                Link={ListLink}
              />
            }
            search={
              <TableSearch
                key={filters.q}
                label="Search the audit log"
                placeholder="Action, person or record ID"
                value={filters.q}
                onSearch={(q) => navigate(auditLogHref(search, { q: q || null }))}
              />
            }
            filters={
              <>
                <div className="w-full sm:w-56">
                  <EntityPicker
                    aria-label="Filter by person"
                    className="h-control-sm text-staff-sm"
                    value={filters.actor || null}
                    selected={
                      filters.actor
                        ? { id: filters.actor, label: filters.actorLabel || "Selected person" }
                        : null
                    }
                    search={searchActors}
                    placeholder="Anyone"
                    searchPlaceholder="Search by name or email"
                    emptyText="No one found."
                    onValueChange={(option) =>
                      navigate(
                        auditLogHref(search, {
                          actor: option?.id ?? null,
                          actorLabel: option?.label ?? null,
                        }),
                      )
                    }
                  />
                </div>
                <FilterMenu
                  label="Record"
                  options={AUDIT_ENTITY_TYPES.map((type) => ({
                    value: type,
                    label: auditEntityTypeLabel(type),
                  }))}
                  selected={filters.entity ? [filters.entity] : []}
                  onChange={(values) =>
                    navigate(
                      auditLogHref(search, {
                        entity: values.find((value) => value !== filters.entity) ?? null,
                      }),
                    )
                  }
                />
                <div className="w-full sm:w-52">
                  <EntityPicker
                    aria-label="Filter by action"
                    className="h-control-sm text-staff-sm"
                    value={filters.action || null}
                    options={actionOptions}
                    placeholder="Any action"
                    searchPlaceholder="Search actions"
                    emptyText="No action matches."
                    onValueChange={(option) =>
                      navigate(auditLogHref(search, { action: option?.id ?? null }))
                    }
                  />
                </div>
                <DateRangeFilter
                  label="Date"
                  value={{ from: filters.from, to: filters.to }}
                  onChange={({ from, to }) =>
                    navigate(auditLogHref(search, { from: from || null, to: to || null }))
                  }
                />
              </>
            }
            activeFilters={
              <ActiveFilterChips
                filters={props.chips.map((chip) => ({
                  id: chip.id,
                  label: chip.label,
                  onRemove: () => navigate(chip.clearHref),
                }))}
                onClearAll={() => navigate(props.clearAllHref)}
              />
            }
            end={<DensityToggle value={density} onChange={setDensity} />}
          />
        }
        error={
          props.loadError ? (
            <ErrorState
              title="The audit log did not load"
              description={props.loadError}
              action={
                <StaffButton size="sm" onClick={() => navigate(auditLogHref(search, {}))}>
                  Try again
                </StaffButton>
              }
            />
          ) : undefined
        }
        empty={
          props.filtered ? (
            <NoResultsState
              title="No events match"
              description="Try another person, action or date range, or clear the filters."
              action={
                <StaffButton size="sm" onClick={() => navigate(AUDIT_LOG_PATH)}>
                  Clear filters
                </StaffButton>
              }
            />
          ) : (
            <EmptyState
              title="No events recorded yet"
              description="Staff and system actions appear here as they happen."
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
      <AuditEventPanel row={open} onClose={() => setOpenId(null)} />
    </>
  );
}
