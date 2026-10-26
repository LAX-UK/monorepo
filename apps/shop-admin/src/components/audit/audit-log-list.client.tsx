"use client";

import { filterChip, useWorkList } from "@/components/use-work-list.client";
import {
  auditActionLabel,
  auditActor,
  auditDetail,
  auditRecordHref,
  auditRecordLabel,
} from "@/server/domain/audit-log.vm";
import { auditList } from "@/server/domain/people-lists.vm";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type { AdminAuditFacets, AdminAuditList } from "@auction/shop-contracts";
import {
  CellLink,
  type DataColumn,
  DetailPanel,
  type EntityOption,
  FilterSheet,
  KeyValueList,
  ListPage,
  type OverflowAction,
  PanelSection,
  PersonCell,
  PrimaryCell,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  formatStaffDate,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ArrowUpRight, PanelRight } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useMemo } from "react";

const NextLink: StaffLinkComponent = Link;

type AuditFilter = "actor" | "action" | "targetType" | "targetId" | "from" | "to";
type AuditState = WorkListState<AuditFilter>;
type AuditRow = AdminAuditList["items"][number];

function actorOptions(facets: AdminAuditFacets): EntityOption[] {
  return facets.actors.map((actor) => {
    const who = auditActor({
      actorSubjectId: actor.subjectId,
      actorName: actor.name,
      actorEmail: actor.email,
    });
    return {
      id: actor.subjectId,
      label: who.name,
      ...(who.email ? { description: who.email } : {}),
    };
  });
}

/**
 * The LAX Admin audit log on the staff list template: who did what to which record and when,
 * newest first (switchable on the server), a filter sheet for person, record, action and dates
 * held in the URL with a chip for each, and the full event in a panel linked from the URL
 * (`?event=`). Actions, records and people read as words; the platform's own work shows as
 * such, never as a person.
 */
export function AuditLogList({
  state,
  page,
  facets,
  loadFailed = false,
}: {
  state: AuditState;
  page: AdminAuditList;
  facets: AdminAuditFacets;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: auditList,
    state,
    page,
    noun: { one: "event", other: "events" },
    search: { label: "Search the audit log", placeholder: "Search by action, person or record ID" },
  });
  const actors = useMemo(() => actorOptions(facets), [facets]);
  const actions = useMemo<EntityOption[]>(
    () =>
      facets.actions
        .map((action) => ({ id: action, label: auditActionLabel(action) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [facets.actions],
  );
  const records = useMemo<EntityOption[]>(
    () =>
      facets.targetTypes
        .map((type) => ({ id: type, label: auditRecordLabel(type) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [facets.targetTypes],
  );
  const opened = page.items.find((row) => row.auditId === list.panel.openId) ?? null;

  const columns = useMemo<DataColumn<AuditRow>[]>(
    () => [
      {
        id: "action",
        header: "Action",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={list.panelHref(row.auditId)} Link={list.panel.PanelLink}>
            {auditActionLabel(row.action)}
          </PrimaryCell>
        ),
      },
      {
        id: "actor",
        header: "Who",
        width: "264px",
        mobile: "meta",
        cell: (row) => {
          const who = auditActor(row);
          return <PersonCell name={who.name} secondary={who.email} kind={who.kind} />;
        },
      },
      {
        id: "record",
        header: "Record",
        width: "192px",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        // Plain words, linked when the record has a page; never the record's id.
        cell: (row) => {
          const href = auditRecordHref(row.targetType, row.targetId);
          const label = auditRecordLabel(row.targetType);
          return href ? (
            <CellLink href={href} Link={NextLink}>
              {label}
            </CellLink>
          ) : (
            label
          );
        },
      },
      {
        id: "when",
        header: "When",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.createdAt} withTime />,
      },
    ],
    [list.panelHref, list.panel.PanelLink],
  );

  const actorLabel = (id: string) =>
    actors.find((option) => option.id === id)?.label ?? "One person";
  const dayRange =
    state.filters.from || state.filters.to
      ? [
          {
            id: "date",
            label:
              state.filters.from && state.filters.to
                ? `${formatStaffDate(state.filters.from)} to ${formatStaffDate(state.filters.to)}`
                : state.filters.from
                  ? `From ${formatStaffDate(state.filters.from)}`
                  : `Until ${formatStaffDate(state.filters.to ?? "")}`,
            onRemove: () => list.navigate(auditList.href(state, { from: null, to: null })),
          },
        ]
      : [];
  const chips = [
    ...list.searchChip,
    ...filterChip(auditList, state, list.navigate, "actor", (id) => `By ${actorLabel(id)}`),
    ...filterChip(
      auditList,
      state,
      list.navigate,
      "targetType",
      (type) => `Record: ${auditRecordLabel(type)}`,
    ),
    ...filterChip(auditList, state, list.navigate, "targetId", () => "One record"),
    ...filterChip(
      auditList,
      state,
      list.navigate,
      "action",
      (action) => `Action: ${auditActionLabel(action)}`,
    ),
    ...dayRange,
  ];

  const rowActions = (row: AuditRow): OverflowAction[] => {
    const who = auditActor(row);
    const href = auditRecordHref(row.targetType, row.targetId);
    return [
      {
        id: "open",
        label: "Open event",
        icon: PanelRight,
        onSelect: () => list.panel.show(row.auditId),
      },
      ...(href
        ? [
            {
              id: "record",
              label: `Open ${auditRecordLabel(row.targetType).toLowerCase()}`,
              href,
            },
          ]
        : []),
      ...(who.kind === "person"
        ? [
            {
              id: "by-actor",
              label: `Only events by ${who.name}`,
              href: auditList.href(state, { actor: row.actorSubjectId }),
            },
          ]
        : []),
      {
        id: "on-record",
        label: "Only events on this record",
        href: auditList.href(state, { targetType: row.targetType, targetId: row.targetId }),
      },
    ];
  };

  return (
    <>
      <ListPage<AuditRow>
        title="Audit log"
        description="Who did what in LAX Admin, and when. Open an event to see exactly what changed."
        Link={list.Link}
        listKey="lax-admin.audit"
        search={list.search}
        filters={
          <FilterSheet
            title="Filter the audit log"
            sections={[
              {
                kind: "entity",
                id: "actor",
                label: "Person",
                value: state.filters.actor ?? "",
                options: actors,
                placeholder: "Anyone",
                searchPlaceholder: "Search by name or email",
                emptyText: "No one found.",
              },
              {
                kind: "entity",
                id: "targetType",
                label: "Record",
                value: state.filters.targetType ?? "",
                options: records,
                placeholder: "Any record",
                searchPlaceholder: "Search record types",
                emptyText: "No record type matches.",
              },
              {
                kind: "entity",
                id: "action",
                label: "Action",
                value: state.filters.action ?? "",
                options: actions,
                placeholder: "Any action",
                searchPlaceholder: "Search actions",
                emptyText: "No action matches.",
              },
              {
                kind: "date-range",
                id: "date",
                label: "Date",
                value: { from: state.filters.from ?? "", to: state.filters.to ?? "" },
              },
            ]}
            onApply={(values) => {
              const date = values.date as { from: string; to: string };
              const targetType = (values.targetType as string) || null;
              list.navigate(
                auditList.href(state, {
                  actor: (values.actor as string) || null,
                  targetType,
                  // A single record only holds while its kind is still chosen.
                  ...(targetType === (state.filters.targetType ?? null) ? {} : { targetId: null }),
                  action: (values.action as string) || null,
                  from: date.from || null,
                  to: date.to || null,
                }),
              );
            }}
          />
        }
        activeFilters={chips}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "The audit log did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(auditList.href(state)),
              }
            : null
        }
        empty={{
          illustration: "ledger",
          title: "No events recorded yet",
          description: "Staff and system actions appear here as they happen.",
        }}
        noResults={{
          title: "No events match",
          description: "Try another person, action or date range, or clear the filters.",
        }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.auditId,
          // The person's email is a second line.
          defaultDensity: "comfortable",
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.auditId),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for ${auditActionLabel(row.action)}`,
            actions: rowActions,
          },
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />
      <AuditEventPanel row={opened} onClose={() => list.panel.show(null)} />
    </>
  );
}

/** One event in full: who, on which record, what changed and what else it recorded. */
function AuditEventPanel({ row, onClose }: { row: AuditRow | null; onClose: () => void }) {
  const detail = row ? auditDetail(row) : { changes: [], facts: [] };
  const who = row ? auditActor(row) : null;
  const href = row ? auditRecordHref(row.targetType, row.targetId) : null;
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      title={row ? auditActionLabel(row.action) : "Event"}
      description={row ? formatStaffDateTime(row.createdAt, { zoneLabel: true }) : undefined}
      footer={
        row && href ? (
          <StaffButton asChild variant="primary" icon={<ArrowUpRight aria-hidden />}>
            <Link href={href}>Open {auditRecordLabel(row.targetType).toLowerCase()}</Link>
          </StaffButton>
        ) : null
      }
    >
      {row ? (
        <div className="flex flex-col gap-6">
          <PanelSection title="Event">
            <KeyValueList
              items={[
                {
                  label: "Who",
                  value: who?.email ? `${who.name} (${who.email})` : (who?.name ?? ""),
                },
                { label: "Record", value: auditRecordLabel(row.targetType) },
                { label: "Record ID", value: row.targetId, copyValue: row.targetId },
                { label: "Event ID", value: row.auditId, copyValue: row.auditId },
              ]}
            />
          </PanelSection>
          <PanelSection title="What changed">
            {detail.changes.length > 0 ? (
              <KeyValueList
                items={detail.changes.map((change) => ({
                  label: change.label,
                  value: `${change.before} → ${change.after}`,
                }))}
              />
            ) : (
              <p className="text-staff-sm text-staff-muted">This event records no field changes.</p>
            )}
          </PanelSection>
          {detail.facts.length > 0 ? (
            <PanelSection title="Details">
              <KeyValueList
                items={detail.facts.map((fact) => ({
                  label: fact.label,
                  value: fact.value,
                  ...(fact.copyValue ? { copyValue: fact.copyValue } : {}),
                }))}
              />
            </PanelSection>
          ) : null}
        </div>
      ) : null}
    </DetailPanel>
  );
}
