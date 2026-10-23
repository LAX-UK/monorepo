"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import { EditorialStatusBadge } from "@/components/editorial/editorial-status-badge";
import { HelpCategoryDialog } from "@/components/help/help-category-dialog.client";
import { useEditorialMutation } from "@/components/use-editorial-mutation";
import {
  deleteHelpCategory,
  reorderHelpCategories,
  setHelpCategoryPublication,
} from "@/server/application/admin-help-actions.server";
import { type HelpCategoryListRow, movedOrder } from "@/server/domain/help-list.vm";
import { Alert, AlertDescription, Button, ConfirmDialog } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

type Dialog =
  | { kind: "form"; row: HelpCategoryListRow | null }
  | { kind: "publish"; row: HelpCategoryListRow }
  | { kind: "delete"; row: HelpCategoryListRow };

export function HelpCategoriesManager({ rows }: { rows: HelpCategoryListRow[] }) {
  const { status, pending, run } = useEditorialMutation();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const ids = rows.map((row) => row.id);

  const move = (id: string, direction: "up" | "down") => {
    const next = movedOrder(ids, id, direction);
    if (!next) return;
    void run((idempotencyKey) => reorderHelpCategories({ ids: next, idempotencyKey }), {
      action: "reorder the categories",
    });
  };

  // Rebuilt every render on purpose: the cells call `move`, which holds the mutation's current
  // idempotency key, and a memoised copy would keep replaying an already-used one.
  const columns: ColumnDef<HelpCategoryListRow, unknown>[] = [
    {
      id: "title",
      header: "Category",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-medium">{row.original.title}</p>
          <p className="font-mono text-xs text-on-surface-variant">/{row.original.slug}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <EditorialStatusBadge status={row.original.status} />,
    },
    {
      id: "questions",
      header: "Questions",
      cell: ({ row }) => (
        <Link
          href={`/help?category=${row.original.id}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {row.original.counts}
        </Link>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const category = row.original;
        const index = ids.indexOf(category.id);
        const publishing = category.status !== "published";
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || index === 0}
              onClick={() => move(category.id, "up")}
            >
              Move up<span className="sr-only">: {category.title}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || index === ids.length - 1}
              onClick={() => move(category.id, "down")}
            >
              Move down<span className="sr-only">: {category.title}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setDialog({ kind: "form", row: category })}
            >
              Edit<span className="sr-only">: {category.title}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setDialog({ kind: "publish", row: category })}
            >
              {publishing ? "Publish" : "Unpublish"}
              <span className="sr-only">: {category.title}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || category.articleCount > 0}
              onClick={() => setDialog({ kind: "delete", row: category })}
            >
              Delete
              <span className="sr-only">
                : {category.title}
                {category.articleCount > 0 ? " (move or delete its questions first)" : ""}
              </span>
            </Button>
          </div>
        );
      },
    },
  ];

  const target = dialog && dialog.kind !== "form" ? dialog.row : null;
  const publishing = target ? target.status !== "published" : false;

  return (
    <div className="space-y-4">
      <div>
        <Button type="button" onClick={() => setDialog({ kind: "form", row: null })}>
          New category
        </Button>
      </div>
      {status ? (
        <Alert variant="destructive">
          <AlertDescription>{status.text}</AlertDescription>
        </Alert>
      ) : null}
      <AdminStaffDataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        empty={{
          title: "No categories yet",
          description: "Create a category, then add questions to it.",
        }}
        ariaLabel="Help centre categories"
      />
      {dialog?.kind === "form" ? (
        <HelpCategoryDialog
          key={dialog.row?.id ?? "new"}
          category={dialog.row}
          onClose={() => setDialog(null)}
        />
      ) : null}
      <ConfirmDialog
        open={dialog?.kind === "publish"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`${publishing ? "Publish" : "Unpublish"} “${target?.title ?? ""}”`}
        body={
          publishing
            ? "Its published questions go live on lax.art straight away."
            : "The category and all of its questions are removed from lax.art straight away. You can publish it again later."
        }
        confirmLabel={publishing ? "Publish" : "Unpublish"}
        tone="warning"
        loading={pending}
        onConfirm={async () => {
          if (!target) return;
          await run(
            (idempotencyKey) =>
              setHelpCategoryPublication({ id: target.id, published: publishing, idempotencyKey }),
            {
              action: `${publishing ? "publish" : "unpublish"} the category`,
              success: publishing ? "Category published on lax.art." : "Category unpublished.",
            },
          );
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Delete “${target?.title ?? ""}”`}
        body="This category is removed and cannot be restored. It has no questions."
        confirmLabel="Delete category"
        loading={pending}
        onConfirm={async () => {
          if (!target) return;
          await run((idempotencyKey) => deleteHelpCategory({ id: target.id, idempotencyKey }), {
            action: "delete the category",
            success: "Category deleted.",
          });
          setDialog(null);
        }}
      />
    </div>
  );
}
