"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import { EditorialStatusBadge } from "@/components/editorial/editorial-status-badge";
import { useEditorialMutation } from "@/components/use-editorial-mutation";
import {
  deleteHelpArticle,
  reorderHelpArticles,
} from "@/server/application/admin-help-actions.server";
import { type HelpArticleListRow, movedOrder } from "@/server/domain/help-list.vm";
import { Alert, AlertDescription, Button, ConfirmDialog } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";

type HelpArticleTableProps = {
  rows: HelpArticleListRow[];
  /**
   * Set when the rows are one whole category in display order, which is the only view where
   * moving a row up or down means something.
   */
  reorderIn: string | null;
  empty: { title: string; description: string };
};

export function HelpArticleTable({ rows, reorderIn, empty }: HelpArticleTableProps) {
  const { status, pending, run } = useEditorialMutation();
  const [deleting, setDeleting] = useState<HelpArticleListRow | null>(null);
  const ids = useMemo(() => rows.map((row) => row.id), [rows]);

  const move = (id: string, direction: "up" | "down") => {
    const next = movedOrder(ids, id, direction);
    if (!next || !reorderIn) return;
    void run(
      (idempotencyKey) => reorderHelpArticles({ categoryId: reorderIn, ids: next, idempotencyKey }),
      { action: "reorder the questions" },
    );
  };

  // Rebuilt every render on purpose: the cells call `move`, which holds the mutation's current
  // idempotency key, and a memoised copy would keep replaying an already-used one.
  const columns: ColumnDef<HelpArticleListRow, unknown>[] = [
    {
      id: "question",
      header: "Question",
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link
            href={`/help/${row.original.id}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {row.original.question}
          </Link>
          <p className="font-mono text-xs text-on-surface-variant">/{row.original.slug}</p>
        </div>
      ),
    },
    { id: "category", header: "Category", cell: ({ row }) => row.original.categoryTitle },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <EditorialStatusBadge status={row.original.status} />,
    },
    { id: "updated", header: "Last updated", cell: ({ row }) => row.original.updated },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const index = ids.indexOf(row.original.id);
        return (
          <div className="flex flex-wrap justify-end gap-2">
            {reorderIn ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || index === 0}
                  onClick={() => move(row.original.id, "up")}
                >
                  Move up
                  <span className="sr-only">: {row.original.question}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || index === ids.length - 1}
                  onClick={() => move(row.original.id, "down")}
                >
                  Move down
                  <span className="sr-only">: {row.original.question}</span>
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setDeleting(row.original)}
            >
              Delete
              <span className="sr-only">: {row.original.question}</span>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {status ? (
        <Alert variant="destructive">
          <AlertDescription>{status.text}</AlertDescription>
        </Alert>
      ) : null}
      <AdminStaffDataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        empty={empty}
        ariaLabel="Help centre questions"
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Delete “${deleting?.question ?? ""}”`}
        body="This question and its answer are removed from lax.art and cannot be restored. Unpublish it instead if you may want it back."
        confirmLabel="Delete question"
        loading={pending}
        onConfirm={async () => {
          if (!deleting) return;
          const target = deleting;
          await run((idempotencyKey) => deleteHelpArticle({ id: target.id, idempotencyKey }), {
            action: "delete the question",
            success: "Question deleted.",
          });
          setDeleting(null);
        }}
      />
    </div>
  );
}
