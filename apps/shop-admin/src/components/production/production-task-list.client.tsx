"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import { ProductionStatusBadge } from "@/components/production/production-status-badge";
import { ProductionTaskControls } from "@/components/production/production-task-controls.client";
import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
import { orderNumber } from "@/server/domain/order-list.vm";
import { productionTaskTitle } from "@/server/domain/production-queue.vm";
import type { AdminProductionTaskListItem, ProductionTaskStaff } from "@auction/shop-contracts";
import { EntityTableShell } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function TaskCell({ task }: { task: AdminProductionTaskListItem }) {
  return (
    <div className="min-w-0">
      <Link
        href={`/production/${task.taskId}`}
        className={`font-medium text-on-surface underline-offset-4 hover:underline ${focusRing}`}
      >
        {productionTaskTitle(task)}
      </Link>
      <p className="text-xs text-on-surface-variant">
        Order{" "}
        <Link
          href={`/orders/${task.orderId}`}
          className={`underline underline-offset-4 ${focusRing}`}
        >
          {orderNumber(task.orderId)}
        </Link>
      </p>
    </div>
  );
}

function Created({ task }: { task: AdminProductionTaskListItem }) {
  return (
    <time dateTime={task.createdAt} className="whitespace-nowrap">
      {formatAdminDetailDateTime(task.createdAt)}
    </time>
  );
}

/**
 * The queue as a table from `lg` upwards and as cards below it, where the assignee and step
 * controls would not fit in a row. The caller handles the empty case.
 */
export function ProductionTaskList({
  items,
  assignees,
  currentSubject,
}: {
  items: AdminProductionTaskListItem[];
  assignees: ProductionTaskStaff[];
  currentSubject: string;
}) {
  const columns = useMemo<ColumnDef<AdminProductionTaskListItem, unknown>[]>(
    () => [
      { id: "task", header: "Task", cell: ({ row }) => <TaskCell task={row.original} /> },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <ProductionStatusBadge status={row.original.status} />,
      },
      {
        id: "work",
        header: "Assignee and next step",
        cell: ({ row }) => (
          <ProductionTaskControls
            task={row.original}
            assignees={assignees}
            currentSubject={currentSubject}
          />
        ),
      },
      { id: "created", header: "Created", cell: ({ row }) => <Created task={row.original} /> },
    ],
    [assignees, currentSubject],
  );

  return (
    <EntityTableShell
      table={
        <AdminStaffDataTable
          ariaLabel="Production tasks"
          columns={columns}
          data={items}
          getRowId={(row) => row.taskId}
          empty={{ title: "No production tasks", description: "Nothing to show." }}
        />
      }
      cards={
        <ul aria-label="Production tasks" className="flex flex-col gap-3">
          {items.map((task) => (
            <li
              key={task.taskId}
              className="rounded-lg border border-border-hairline bg-surface-container-lowest p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <TaskCell task={task} />
                <ProductionStatusBadge status={task.status} />
              </div>
              <div className="mt-3">
                <ProductionTaskControls
                  task={task}
                  assignees={assignees}
                  currentSubject={currentSubject}
                />
              </div>
              <p className="mt-3 text-xs text-on-surface-variant">
                Created <Created task={task} />
              </p>
            </li>
          ))}
        </ul>
      }
    />
  );
}
