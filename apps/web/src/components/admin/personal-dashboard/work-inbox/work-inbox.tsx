"use client";

import { StaffBulkOperations } from "@/components/admin/staff/staff-bulk-operations";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import type { BulkOperation } from "@/lib/admin/bulk-ops/types";
import { toSequentialBulkResult } from "@/lib/admin/catalog-bulk-result-handler";
import {
  WORK_ACTION_LABELS,
  WORK_AREA_LABELS,
  type WorkArea,
  type WorkAssignment,
  filterWorkByArea,
  sharedWorkAction,
  workActionConfirm,
  workActionIsDestructive,
  workAreaViews,
  workInboxHref,
  workInboxSummary,
  workOwner,
  workPriority,
} from "@/lib/admin/dashboard/work-inbox.vm";
import type { AdminWorkItem, AdminWorkItemDomain } from "@/lib/data/http/admin-work-items.schema";
import {
  type DataColumn,
  DataTable,
  DataViews,
  DetailPanel,
  EmptyState,
  NoResultsState,
  OverflowMenu,
  PrimaryCell,
  Section,
  SegmentedControl,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  rowActionsColumn,
} from "@auction/staff-ui";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { runWorkItemAction, useWorkItemActions } from "./use-work-item-actions";

/** Area tabs filter the loaded items in place, so they keep the scroll position. */
const NoScrollLink: StaffLinkComponent = (props) => <Link {...props} scroll={false} />;

const ASSIGNMENT_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "mine", label: "Mine" },
  { value: "unassigned", label: "Unassigned" },
] as const;

export type WorkInboxProps = {
  items: readonly AdminWorkItem[];
  counts: { total: number; byDomain: Partial<Record<AdminWorkItemDomain, number>> };
  /** The areas this person works in. */
  areas: readonly AdminWorkItemDomain[];
  area: WorkArea;
  assignment: WorkAssignment;
  /** The metrics period, kept in the URL when the inbox filters change. */
  period?: string | undefined;
  /** The item open in the panel when the page loaded. */
  openItemId?: string | null;
  actorUserId: string;
  /** Why the inbox has nothing, when the API says. */
  emptyMessage?: string | null;
};

/**
 * The work waiting on this person, first on Overview: one row per item, urgent ones marked, each
 * with its `…` menu of actions. A row opens the item in a panel beside the list (linked from the
 * URL); items that share an action can be handled together from the bulk bar. Area tabs and the
 * assignment switch filter the list.
 */
export function WorkInbox({
  items,
  counts,
  areas,
  area,
  assignment,
  period,
  openItemId = null,
  actorUserId,
  emptyMessage,
}: WorkInboxProps) {
  const router = useRouter();
  const base = useMemo(() => ({ area, assignment, period }), [area, assignment, period]);
  const panelHref = useCallback((id: string | null) => workInboxHref(base, { item: id }), [base]);
  const panel = useListPanel({ param: "item", initialId: openItemId, hrefFor: panelHref });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const actions = useWorkItemActions({ onDone: () => panel.show(null) });

  const rows = useMemo(() => filterWorkByArea(items, area), [items, area]);
  const open = rows.find((item) => item.id === panel.openId) ?? null;
  const filtered = area !== "all" || assignment !== "all";

  const columns = useMemo<DataColumn<AdminWorkItem>[]>(
    () => [
      {
        id: "item",
        header: "Item",
        mobile: "title",
        cell: (item) => (
          <PrimaryCell
            href={panelHref(item.id)}
            Link={panel.PanelLink}
            secondary={item.subtitle ?? undefined}
          >
            {item.title}
          </PrimaryCell>
        ),
      },
      {
        id: "priority",
        header: "Priority",
        width: "112px",
        mobile: "badge",
        truncate: false,
        cell: (item) => {
          const priority = workPriority(item.severity);
          return priority ? <StatusBadge tone={priority.tone}>{priority.label}</StatusBadge> : null;
        },
      },
      {
        id: "area",
        header: "Area",
        width: "136px",
        mobile: "meta",
        hideBelow: "lg",
        cell: (item) => WORK_AREA_LABELS[item.domain],
      },
      {
        id: "owner",
        header: "Owner",
        width: "128px",
        mobile: "meta",
        hideBelow: "lg",
        cell: (item) => workOwner(item, actorUserId),
      },
      {
        id: "due",
        header: "Due",
        width: "136px",
        numeric: true,
        mobile: "meta",
        sortable: true,
        defaultSortDirection: "asc",
        sortValue: (item) => item.dueAt ?? item.createdAt,
        cell: (item) => <StaffDate value={item.dueAt ?? item.createdAt} withTime />,
      },
      rowActionsColumn<AdminWorkItem>({
        label: (item) => `Actions for ${item.title}`,
        actions: (item) => actions.actionsFor(item),
        Link,
      }),
    ],
    [actions, actorUserId, panel.PanelLink, panelHref],
  );

  const bulkOperations = (chosen: AdminWorkItem[]): BulkOperation[] => {
    const action = sharedWorkAction(chosen);
    if (!action) return [];
    const ask = chosen[0] ? workActionConfirm(chosen[0], action) : null;
    return [
      {
        id: action,
        label: WORK_ACTION_LABELS[action],
        destructive: workActionIsDestructive(action),
        ...(ask ? { confirm: ask.description } : {}),
        run: async (ids) => {
          const failures: string[] = [];
          for (const item of chosen) {
            if (!ids.includes(item.id)) continue;
            const result = await runWorkItemAction(item, action);
            if (!result.ok) failures.push(item.id);
          }
          return { ok: true as const, data: toSequentialBulkResult(ids, failures) };
        },
      },
    ];
  };

  const views = workAreaViews({
    areas,
    counts: counts.byDomain,
    total: counts.total,
    href: (next) => workInboxHref(base, { area: next }),
  });

  const assignmentControl = (
    <SegmentedControl
      label="Whose work"
      value={assignment}
      options={ASSIGNMENT_OPTIONS}
      onValueChange={(next) =>
        router.replace(workInboxHref(base, { assignment: next }), { scroll: false })
      }
    />
  );

  const clear = (
    <StaffButton asChild size="sm">
      <Link href={workInboxHref(base, { area: "all", assignment: "all" })} scroll={false}>
        Show all work
      </Link>
    </StaffButton>
  );

  const priority = open ? workPriority(open.severity) : null;
  const owner = open ? workOwner(open, actorUserId) : null;
  const panelActions = open ? actions.actionsFor(open).filter((a) => a.id !== "open-record") : [];
  const [primaryAction, ...otherActions] = panelActions.filter((a) => a.tone !== "danger");
  const dangerActions = panelActions.filter((a) => a.tone === "danger");

  return (
    <Section
      id="work-inbox"
      title="Your work"
      description={workInboxSummary(rows)}
      action={assignmentControl}
      bodyClassName="p-0"
    >
      <DataTable
        embedded
        label="Your work"
        columns={columns}
        data={rows}
        getRowId={(item) => item.id}
        defaultSort={{ columnId: "due", direction: "asc" }}
        onRowOpen={(item) => panel.show(item.id)}
        activeRowId={panel.openId}
        toolbar={<DataViews views={views} activeId={area} Link={NoScrollLink} />}
        stickyToolbar={false}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        bulkNoun={{ one: "item", other: "items" }}
        bulkActions={(chosen) => {
          const operations = bulkOperations(chosen);
          return operations.length > 0 ? (
            <StaffBulkOperations
              operations={operations}
              selectedIds={chosen.map((item) => item.id)}
              onClear={() => setSelected(new Set())}
              noun={{ one: "item", other: "items" }}
            />
          ) : (
            <StaffButton
              size="sm"
              variant="ghost"
              disabledReason="These items have no action in common"
            >
              No shared action
            </StaffButton>
          );
        }}
        empty={
          filtered ? (
            <NoResultsState
              title="No work matches"
              description="Nothing in this area or assignment needs you right now."
              action={clear}
              headingLevel="h3"
              size="compact"
            />
          ) : (
            <EmptyState
              title="Nothing needs you right now"
              description={emptyMessage ?? "New work appears here as it comes in."}
              headingLevel="h3"
              size="compact"
            />
          )
        }
      />

      {open ? (
        <DetailPanel
          open
          onOpenChange={(next) => {
            if (!next) panel.show(null);
          }}
          title={open.title}
          {...(open.subtitle ? { description: open.subtitle } : {})}
          {...(priority
            ? { status: <StatusBadge tone={priority.tone}>{priority.label}</StatusBadge> }
            : {})}
          meta={[
            { label: "Area", value: WORK_AREA_LABELS[open.domain] },
            ...(owner ? [{ label: "Owner", value: owner }] : []),
            { label: "Due", value: <StaffDate value={open.dueAt ?? open.createdAt} withTime /> },
          ]}
          headerActions={
            <StaffButton asChild size="sm" variant="ghost" icon={<ExternalLink aria-hidden />}>
              <Link href={open.href}>Open full page</Link>
            </StaffButton>
          }
          {...(dangerActions.length > 0 || otherActions.length > 1
            ? {
                overflow: (
                  <OverflowMenu
                    actions={[...otherActions.slice(1), ...dangerActions]}
                    label={`More actions for ${open.title}`}
                  />
                ),
              }
            : {})}
          footer={
            primaryAction ? (
              <>
                {otherActions[0] ? (
                  <StaffButton
                    disabled={actions.running}
                    onClick={() => otherActions[0]?.onSelect?.()}
                  >
                    {otherActions[0].label}
                  </StaffButton>
                ) : null}
                <StaffButton
                  variant="primary"
                  loading={actions.running}
                  onClick={() => primaryAction.onSelect?.()}
                >
                  {primaryAction.label}
                </StaffButton>
              </>
            ) : (
              <StaffButton asChild variant="primary">
                <Link href={open.href}>Open record</Link>
              </StaffButton>
            )
          }
        >
          {null}
        </DetailPanel>
      ) : null}
      {actions.dialog}
    </Section>
  );
}
