"use client";

import { AuditEventPanel } from "@/components/admin/audit/audit-event-panel";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { searchAuditActorsAction } from "@/lib/actions/admin-audit-actors";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { AuditActionOption } from "@/lib/admin/audit/audit-action-options";
import {
  AUDIT_LOG_PATH,
  type AuditFilterChip,
  type AuditLogFilters,
  type AuditLogSearch,
  auditLogHref,
  auditLogSortHref,
} from "@/lib/admin/audit/audit-log-search";
import {
  AUDIT_ENTITY_TYPES,
  type AuditLogRowModel,
  auditEntityTypeLabel,
} from "@/lib/admin/audit/audit-log.vm";
import {
  CellLink,
  type DataColumn,
  DataViews,
  type EntityOption,
  FilterSheet,
  ListPage,
  PersonCell,
  PrimaryCell,
  StaffDate,
  TableSearch,
} from "@auction/staff-ui";
import Link from "next/link";
import { useCallback, useMemo } from "react";

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
  /** A search or filter narrows the log (the view tab alone does not). */
  filtered: boolean;
};

const VIEWS = [
  { id: "all", label: "All", view: null },
  { id: "finance", label: "Finance", view: "finance" },
  { id: "catalogue", label: "Catalogue", view: "catalogue" },
  { id: "people", label: "People", view: "people" },
  { id: "operations", label: "Operations", view: "operations" },
] as const;

const VIEW_EMPTY: Record<string, string> = {
  all: "No events recorded yet",
  finance: "No finance events yet",
  catalogue: "No catalogue events yet",
  people: "No people events yet",
  operations: "No operations events yet",
};

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

/**
 * The global audit log on the staff list template: views by area, search, a filter sheet for
 * person, record type, action and dates (all held in the URL), newest first by default with the
 * order switchable on the server, and the full event in a panel deep-linked with `?event=`.
 */
export function AuditLogList(props: AuditLogListProps) {
  const { rows, search, filters } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const panelHref = useCallback(
    (id: string | null) => buildListHref(AUDIT_LOG_PATH, search, { event: id }),
    [search],
  );
  const panel = useListPanel({
    param: "event",
    initialId: typeof search.event === "string" ? search.event : null,
    hrefFor: panelHref,
  });
  const actionOptions = useMemo<EntityOption[]>(
    () =>
      props.actions.map((action) => ({
        id: action.value,
        label: action.label,
        // Shop events share names with Bid's ("Dispute opened"), so say which product.
        ...(action.value.startsWith("shop.") ? { description: "LAX Shop" } : {}),
      })),
    [props.actions],
  );

  const entityOptions = useMemo<EntityOption[]>(
    () => AUDIT_ENTITY_TYPES.map((type) => ({ id: type, label: auditEntityTypeLabel(type) })),
    [],
  );

  const columns = useMemo<DataColumn<AuditLogRowModel>[]>(
    () => [
      {
        id: "action",
        header: "Action",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={panelHref(row.id)} Link={panel.PanelLink} secondary={row.summary}>
            {row.action}
          </PrimaryCell>
        ),
      },
      {
        id: "actor",
        header: "Who",
        width: "248px",
        mobile: "meta",
        cell: (row) => (
          <PersonCell
            name={row.actor.name}
            secondary={row.actor.email}
            kind={row.actor.kind === "system" ? "system" : "person"}
          />
        ),
      },
      {
        id: "entity",
        header: "Record",
        width: "176px",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) =>
          row.entity.href ? (
            <CellLink href={row.entity.href} Link={Link}>
              {row.entity.typeLabel}
            </CellLink>
          ) : (
            row.entity.typeLabel
          ),
      },
      {
        id: "when",
        header: "When",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.at} withTime />,
      },
    ],
    [panelHref, panel.PanelLink],
  );

  const open = rows.find((row) => row.id === panel.openId) ?? null;
  const view = filters.view ?? "all";

  return (
    <>
      <ListPage<AuditLogRowModel>
        title="Audit log"
        description="Who did what across the platform, and when. Open an event to see exactly what changed."
        Link={ListLink}
        listKey="bid-admin.audit"
        views={
          <DataViews
            views={VIEWS.map((item) => ({
              id: item.id,
              label: item.label,
              href: auditLogHref(search, { view: item.view }),
            }))}
            activeId={view}
            Link={ListLink}
          />
        }
        search={
          <TableSearch
            key={filters.q}
            fullWidth
            label="Search the audit log"
            placeholder="Search by action, person or record ID"
            value={filters.q}
            onSearch={(q) => navigate(auditLogHref(search, { q: q || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter the audit log"
            sections={[
              {
                kind: "entity",
                id: "actor",
                label: "Person",
                value: filters.actor,
                search: searchActors,
                selected: filters.actor
                  ? { id: filters.actor, label: filters.actorLabel || "Selected person" }
                  : null,
                placeholder: "Anyone",
                searchPlaceholder: "Search by name or email",
                emptyText: "No one found.",
              },
              {
                kind: "entity",
                id: "entity",
                label: "Record",
                value: filters.entity,
                options: entityOptions,
                placeholder: "Any record",
                searchPlaceholder: "Search record types",
                emptyText: "No record type matches.",
              },
              {
                kind: "entity",
                id: "action",
                label: "Action",
                value: filters.action,
                options: actionOptions,
                placeholder: "Any action",
                searchPlaceholder: "Search actions",
                emptyText: "No action matches.",
              },
              {
                kind: "date-range",
                id: "date",
                label: "Date",
                value: { from: filters.from, to: filters.to },
              },
            ]}
            onApply={(values) => {
              const date = values.date as { from: string; to: string };
              const actor = (values.actor as string) || null;
              navigate(
                auditLogHref(search, {
                  actor,
                  // Keep the person's name for the chip when they are still chosen.
                  ...(actor && actor === filters.actor ? {} : { actorLabel: null }),
                  entity: (values.entity as string) || null,
                  action: (values.action as string) || null,
                  from: date.from || null,
                  to: date.to || null,
                }),
              );
            }}
          />
        }
        activeFilters={props.chips.map((chip) => ({
          id: chip.id,
          label: chip.label,
          onRemove: () => navigate(chip.clearHref),
        }))}
        onClearFilters={() => navigate(props.clearAllHref)}
        loading={pending}
        filtered={props.filtered}
        error={
          props.loadError
            ? {
                title: "The audit log did not load",
                description: props.loadError,
                onRetry: () => navigate(auditLogHref(search, {})),
              }
            : null
        }
        empty={{
          title: VIEW_EMPTY[view] ?? "No events recorded yet",
          description: "Staff and system actions appear here as they happen.",
        }}
        noResults={{ noun: "events" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          // Each event carries its summary and the person's email as second lines.
          defaultDensity: "comfortable",
          defaultSort: { columnId: "when", direction: "desc" },
          sort: { columnId: "when", direction: filters.sort === "at_asc" ? "asc" : "desc" },
          onSortChange: (sort) =>
            navigate(auditLogSortHref(search, sort.direction === "asc" ? "at_asc" : "at_desc")),
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: panel.openId,
          rowActions: {
            label: (row) => `Actions for ${row.action}`,
            actions: (row) => [
              { id: "open", label: "Open event", onSelect: () => panel.show(row.id) },
              ...(row.entity.href
                ? [
                    {
                      id: "record",
                      label: `Open ${row.entity.typeLabel.toLowerCase()}`,
                      href: row.entity.href,
                    },
                  ]
                : []),
              ...(row.actorUserId
                ? [
                    {
                      id: "by-actor",
                      label: `Only events by ${row.actor.name}`,
                      href: auditLogHref(search, {
                        actor: row.actorUserId,
                        actorLabel: row.actor.name,
                      }),
                    },
                  ]
                : []),
              {
                id: "on-record",
                label: "Only events on this record",
                href: auditLogHref(search, { q: row.entity.id }),
              },
            ],
          },
        }}
        pagination={props.pagination}
      />
      <AuditEventPanel row={open} onClose={() => panel.show(null)} />
    </>
  );
}
