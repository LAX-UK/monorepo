"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { EditableCell } from "@/components/admin/editable-cell";
import { adminUpdateCategoryNameFieldAction } from "@/lib/actions/admin/field-updates";
import type { CategoryTaxonomyRow } from "@/lib/admin/categories/category-taxonomy-rows";
import type { AdminCategory } from "@auction/types";
import { InlineActionMenu } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ActionHandlers = {
  onRequestAction: (category: AdminCategory, action: "archive" | "delete") => void;
  pending: boolean;
  pendingId: string | null;
};

function CategoryActionMenu({
  row,
  handlers,
}: {
  row: CategoryTaxonomyRow;
  handlers: ActionHandlers;
}) {
  const router = useRouter();
  const rowPending = handlers.pending && handlers.pendingId === row.id;
  const canDelete = row.usage.total === 0;

  return (
    <InlineActionMenu
      label={`Actions for ${row.name}`}
      items={[
        {
          type: "item",
          label: "Open",
          onSelect: () => router.push(`/admin/categories/${row.id}`),
        },
        {
          type: "item",
          label: "Edit",
          onSelect: () => router.push(`/admin/categories/${row.id}/edit`),
        },
        ...(!row.archived
          ? [
              {
                type: "item" as const,
                label: "Archive",
                disabled: rowPending,
                onSelect: () => handlers.onRequestAction(row, "archive"),
              },
            ]
          : []),
        ...(canDelete
          ? [
              {
                type: "item" as const,
                label: "Delete",
                disabled: rowPending,
                onSelect: () => handlers.onRequestAction(row, "delete"),
              },
            ]
          : []),
      ]}
    />
  );
}

export function categoryColumns(handlers: ActionHandlers): ColumnDef<CategoryTaxonomyRow>[] {
  return [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div
            className="min-w-0"
            style={{ paddingInlineStart: `${Math.min(c.depth, 4) * 0.75}rem` }}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              {c.depth > 0 ? (
                <ChevronRight className="size-3.5 shrink-0 text-on-surface-variant" aria-hidden />
              ) : null}
              <EditableCell
                value={c.name}
                onSave={(next) => adminUpdateCategoryNameFieldAction(c.id, next)}
                className="font-headline text-sm font-semibold"
              />
              <Link href={`/admin/categories/${c.id}`} className="sr-only">
                View {c.name}
              </Link>
            </div>
            {c.heroImageKey ? (
              <Badge
                variant="outline"
                className="mt-1 font-body text-[10px] font-normal normal-case"
              >
                Has hero
              </Badge>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "lots",
      header: "Lots",
      meta: { numeric: true },
      cell: ({ row }) => row.original.usage.lots,
    },
    {
      id: "sales",
      header: "Sales",
      meta: { numeric: true },
      cell: ({ row }) => row.original.usage.sales,
    },
    {
      id: "submissions",
      header: "Submissions",
      meta: { numeric: true },
      cell: ({ row }) => row.original.usage.submissions,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <AdminStatusBadge
          domain="category"
          status={row.original.archived ? "archived" : "active"}
        />
      ),
    },
    {
      id: "updatedAt",
      header: "Last updated",
      cell: ({ row }) => (
        <AdminTableDateTimeCell iso={row.original.updatedAt.toISOString()} mode="dateOnly" />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <CategoryActionMenu row={row.original} handlers={handlers} />,
      enableSorting: false,
    },
  ];
}
