"use client";

import {
  UNASSIGNED,
  useProductionTaskActions,
} from "@/components/production/use-production-task-actions.client";
import { filterChip, useWorkList } from "@/components/use-work-list.client";
import { presentProductionStatus } from "@/server/domain/order-detail.vm";
import { orderNumber } from "@/server/domain/order-list.vm";
import {
  PRODUCTION_ASSIGNEE_LABELS,
  type ProductionAssigneeFilter,
  productionAssigneeName,
  productionTaskTitle,
} from "@/server/domain/production-queue.vm";
import { productionList } from "@/server/domain/sales-lists.vm";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type {
  AdminProductionTaskList,
  AdminProductionTaskListItem,
  ProductionTaskStaff,
} from "@auction/shop-contracts";
import {
  type DataColumn,
  DetailPanel,
  EnumSelect,
  Field,
  FilterSheet,
  ListPage,
  MappedStatusBadge,
  OverflowMenu,
  PanelSection,
  PersonCell,
  PrimaryCell,
  StaffButton,
  StaffDate,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ArrowUpRight, PanelRight, ReceiptText } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useMemo } from "react";

type Task = AdminProductionTaskListItem;

/**
 * The production queue on the staff list template: a view per status with counts, a filter for
 * my tasks or unassigned ones, search by artwork, order number or task ID, newest first on the
 * server, and a record panel linked from the URL (`?task=`) to assign the task and move it on.
 */
export function ProductionQueue({
  state,
  page,
  assignees,
  currentSubject,
  loadFailed = false,
}: {
  state: WorkListState<"assignee">;
  /** Counts are left out when the list did not load. */
  page: Omit<AdminProductionTaskList, "counts"> & { counts?: AdminProductionTaskList["counts"] };
  assignees: ProductionTaskStaff[];
  currentSubject: string;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: productionList,
    state,
    page,
    noun: { one: "task", other: "tasks" },
    search: {
      label: "Search production tasks",
      placeholder: "Search by artwork, order number or task ID",
    },
  });
  const tasks = useProductionTaskActions({ assignees, currentSubject });
  const opened = page.items.find((task) => task.taskId === list.panel.openId) ?? null;
  const next = opened ? tasks.nextStep(opened) : null;
  const others = opened ? tasks.actionsFor(opened, { skipNext: true }) : [];

  const columns = useMemo<DataColumn<Task>[]>(
    () => [
      {
        id: "task",
        header: "Task",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={list.panelHref(row.taskId)}
            Link={list.panel.PanelLink}
            secondary={`Order ${orderNumber(row.orderId, row.orderReference)}`}
          >
            {productionTaskTitle(row)}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "200px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentProductionStatus} />,
      },
      {
        id: "assignee",
        header: "Assignee",
        width: "24%",
        mobile: "meta",
        cell: (row) =>
          row.assignee ? <PersonCell name={productionAssigneeName(row.assignee)} /> : "Unassigned",
      },
      {
        id: "created",
        header: "Created",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.createdAt} withTime />,
      },
    ],
    [list.panelHref, list.panel.PanelLink],
  );

  const assigneeChip = filterChip(
    productionList,
    state,
    list.navigate,
    "assignee",
    (value) =>
      `Assignee: ${PRODUCTION_ASSIGNEE_LABELS[value as ProductionAssigneeFilter] ?? value}`,
  );

  return (
    <>
      <ListPage<Task>
        title="Production"
        description="Made-to-order work for editions that have been sold but not yet produced. Send an item to production from its order."
        Link={list.Link}
        listKey="lax-admin.production"
        views={list.views}
        search={list.search}
        filters={
          <FilterSheet
            title="Filter production tasks"
            sections={[
              {
                kind: "radio",
                id: "assignee",
                label: "Assignee",
                anyLabel: "Anyone",
                options: (["me", "unassigned"] as const).map((value) => ({
                  value,
                  label: value === "me" ? "Assigned to me" : PRODUCTION_ASSIGNEE_LABELS[value],
                })),
                value: state.filters.assignee ?? "",
              },
            ]}
            onApply={(values) =>
              list.navigate(
                productionList.href(state, { assignee: (values.assignee as string) || null }),
              )
            }
          />
        }
        activeFilters={[...list.searchChip, ...assigneeChip]}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Production tasks did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(productionList.href(state)),
              }
            : null
        }
        empty={{
          illustration: "easel",
          title: "No production tasks",
          description:
            "When an edition needs to be made, send it to production from its order and the task appears here.",
        }}
        noResults={{
          title: "No tasks match",
          description: "Try a different search, or clear the filters to see every task.",
        }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.taskId,
          defaultDensity: "comfortable",
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.taskId),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for ${productionTaskTitle(row)}`,
            actions: (row) => [
              {
                id: "open",
                label: "Open details",
                icon: PanelRight,
                onSelect: () => list.panel.show(row.taskId),
              },
              ...tasks.actionsFor(row),
              {
                id: "order",
                label: "Open order",
                icon: ReceiptText,
                href: `/orders/${row.orderId}`,
              },
            ],
          },
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened ? productionTaskTitle(opened) : "Production task"}
        status={
          opened ? (
            <MappedStatusBadge status={opened.status} present={presentProductionStatus} />
          ) : null
        }
        headerActions={
          opened ? (
            <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
              <Link href={`/production/${opened.taskId}`}>Open full page</Link>
            </StaffButton>
          ) : null
        }
        overflow={
          opened && others.length > 0 ? (
            <OverflowMenu
              label={`More actions for ${productionTaskTitle(opened)}`}
              actions={others}
            />
          ) : null
        }
        notice={tasks.error}
        meta={
          opened
            ? [
                { label: "Order", value: orderNumber(opened.orderId, opened.orderReference) },
                {
                  label: "Created",
                  value: formatStaffDateTime(opened.createdAt, { zoneLabel: true }),
                },
              ]
            : []
        }
        summary={
          opened
            ? [
                {
                  label: "Last change",
                  value: formatStaffDateTime(opened.updatedAt, { zoneLabel: true }),
                },
                { label: "Task ID", value: opened.taskId, copyValue: opened.taskId },
              ]
            : []
        }
        footer={
          opened && next ? (
            <StaffButton variant="primary" loading={tasks.pending} onClick={next.run}>
              {next.label}
            </StaffButton>
          ) : null
        }
      >
        {opened ? (
          <PanelSection title="Assignee">
            <Field label="Assigned to">
              <EnumSelect
                value={opened.assignee?.subject ?? UNASSIGNED}
                options={tasks.assigneeOptions(opened)}
                disabled={tasks.pending}
                onValueChange={(value) => tasks.assign(opened, value === UNASSIGNED ? null : value)}
              />
            </Field>
          </PanelSection>
        ) : null}
      </DetailPanel>
      {tasks.dialogs}
    </>
  );
}
