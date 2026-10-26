"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  adminArchiveCategoryResultAction,
  adminDeleteCategoryResultAction,
  adminUpdateCategoryResultAction,
} from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import type { OverflowAction } from "@auction/staff-ui";
import type { AdminCategory } from "@auction/types";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/** What still uses a category, in words: "3 lots, 1 sale and 2 submissions". */
export function categoryUsageSummary(usage: AdminCategory["usage"]): string {
  const parts = [
    usage.lots > 0 ? `${usage.lots} ${usage.lots === 1 ? "lot" : "lots"}` : null,
    usage.sales > 0 ? `${usage.sales} ${usage.sales === 1 ? "sale" : "sales"}` : null,
    usage.submissions > 0
      ? `${usage.submissions} ${usage.submissions === 1 ? "submission" : "submissions"}`
      : null,
    usage.interests > 0
      ? `${usage.interests} buyer ${usage.interests === 1 ? "interest" : "interests"}`
      : null,
  ].filter((part): part is string => part !== null);
  if (parts.length <= 1) return parts[0] ?? "nothing";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/**
 * The category page's state-changing actions: archive (hidden from new assignments, undoable
 * from the toast), restore, and delete a category nothing uses (asked about first through the
 * kit confirm).
 */
export function useCategoryActions(category: AdminCategory) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const { ask } = confirm;

  const archive = useCallback(async () => {
    const result = await adminArchiveCategoryResultAction(category.id);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    notify.success(`${category.name} archived`, {
      action: {
        label: "Undo",
        onClick: () => {
          void adminUpdateCategoryResultAction(category.id, { archived: false }).then((undo) => {
            if (undo.ok) router.refresh();
            else notify.error(undo.error);
          });
        },
      },
    });
    router.refresh();
  }, [category.id, category.name, router]);

  const restore = useCallback(async () => {
    const result = await adminUpdateCategoryResultAction(category.id, { archived: false });
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    notify.success(`${category.name} restored`);
    router.refresh();
  }, [category.id, category.name, router]);

  const remove = useCallback(
    () =>
      ask({
        title: `Delete ${category.name}?`,
        description:
          "The category is removed. Nothing refers to it, but this cannot be undone. To keep it in history, archive it instead.",
        confirmLabel: "Delete category",
        cancelLabel: "Keep category",
        tone: "danger",
        run: () => adminDeleteCategoryResultAction(category.id),
        success: `${category.name} deleted`,
        onSuccess: () => {
          router.push("/admin/categories");
          router.refresh();
        },
      }),
    [ask, category.id, category.name, router],
  );

  const canDelete = category.usage.total === 0;
  const items: OverflowAction[] = [
    category.archived
      ? {
          id: "restore",
          label: "Restore category",
          icon: ArchiveRestore,
          onSelect: () => void restore(),
        }
      : { id: "archive", label: "Archive category", icon: Archive, onSelect: () => void archive() },
    {
      id: "delete",
      label: "Delete category",
      icon: Trash2,
      tone: "danger",
      onSelect: remove,
      ...(canDelete
        ? {}
        : {
            disabledReason: `Still used by ${categoryUsageSummary(category.usage)}. Archive it instead.`,
          }),
    },
  ];

  return { items, dialogs: confirm.dialog };
}
