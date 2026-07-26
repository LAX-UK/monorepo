"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import {
  adminArchiveCategoryResultAction,
  adminDeleteCategoryResultAction,
} from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import type { AdminCategory } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  category: AdminCategory;
};

export function CategoryDestructivePanel({ category }: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"archive" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();

  const canDelete = category.usage.total === 0;
  const canArchive = !category.archived;

  if (!canDelete && !canArchive) {
    return (
      <section className="space-y-2 rounded-md border border-outline-variant/40 p-4">
        <h2 className="font-heading text-sm">Lifecycle</h2>
        <p className="text-sm text-on-surface-variant">
          This category is archived and still referenced across the catalogue. It cannot be deleted
          until all assignments are removed.
        </p>
      </section>
    );
  }

  const runAction = (action: "archive" | "delete") => {
    startTransition(async () => {
      const result =
        action === "archive"
          ? await adminArchiveCategoryResultAction(category.id)
          : await adminDeleteCategoryResultAction(category.id);
      setPendingAction(null);
      if (result.ok) {
        notify.success(action === "archive" ? "Category archived" : "Category deleted");
        if (action === "delete") {
          router.push("/admin/categories");
        } else {
          router.refresh();
        }
        return;
      }
      notify.error(result.error);
    });
  };

  return (
    <section className="space-y-4 rounded-md border border-outline-variant/40 p-4">
      <div>
        <h2 className="font-heading text-sm">Lifecycle</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Archive categories that are still referenced, or permanently delete unused categories.
        </p>
      </div>

      {!canDelete && canArchive ? (
        <p className="text-sm text-on-surface-variant">
          Delete is unavailable while lots, sales, or submissions still reference this category.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canArchive ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setPendingAction("archive")}
          >
            Archive category…
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => setPendingAction("delete")}
          >
            Delete category…
          </Button>
        ) : null}
      </div>

      {pendingAction ? (
        <TypedConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingAction(null);
          }}
          title={pendingAction === "archive" ? "Archive this category?" : "Delete this category?"}
          description={
            pendingAction === "archive"
              ? "Archived categories stay in the tree but are hidden from new assignments."
              : "This permanently removes an unused category. This cannot be undone."
          }
          actionLabel={pendingAction === "archive" ? "Archive" : "Delete"}
          confirmationPhrase={category.slug}
          severity={pendingAction === "delete" ? "danger" : "warning"}
          onConfirm={() => runAction(pendingAction)}
        />
      ) : null}
    </section>
  );
}
