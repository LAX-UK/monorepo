"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  adminArchiveCategoryResultAction,
  adminDeleteCategoryResultAction,
} from "@/lib/actions/admin";
import type { OverflowAction } from "@auction/staff-ui";
import { useCallback } from "react";

/** What the category actions need to know about a category, from a list row. */
export type CategoryActionTarget = {
  id: string;
  name: string;
  archived: boolean;
  /** Nothing is assigned to the category, so it may be deleted. */
  canDelete: boolean;
};

const DELETE_BLOCKED =
  "Lots, sales, submissions or buyer interests still use this category. Archive it instead";

/**
 * A category's state-changing actions from a list row's `…` menu or its panel: archive and
 * delete. Each asks first through the kit confirm. Delete is offered for every category and
 * disabled, with the reason, while anything is still assigned to it.
 */
export function useCategoryActions() {
  const confirm = useStaffConfirm();
  const { ask } = confirm;

  const archive = useCallback(
    (category: CategoryActionTarget) =>
      ask({
        title: `Archive ${category.name}?`,
        description:
          "It stays in the taxonomy but is hidden from new assignments. Records already using it keep it.",
        confirmLabel: "Archive category",
        run: () => adminArchiveCategoryResultAction(category.id),
        success: `${category.name} archived`,
      }),
    [ask],
  );

  const remove = useCallback(
    (category: CategoryActionTarget) =>
      ask({
        title: `Delete ${category.name}?`,
        description: "The unused category is removed for good. This cannot be undone.",
        confirmLabel: "Delete category",
        tone: "danger",
        run: () => adminDeleteCategoryResultAction(category.id),
        success: `${category.name} deleted`,
      }),
    [ask],
  );

  const actionsFor = useCallback(
    (category: CategoryActionTarget): OverflowAction[] => {
      const actions: OverflowAction[] = [];
      if (!category.archived) {
        actions.push({
          id: "archive",
          label: "Archive category…",
          onSelect: () => archive(category),
        });
      }
      actions.push({
        id: "delete",
        label: "Delete category…",
        tone: "danger",
        onSelect: () => remove(category),
        ...(category.canDelete ? {} : { disabledReason: DELETE_BLOCKED }),
      });
      return actions;
    },
    [archive, remove],
  );

  return { actionsFor, archive, remove, dialogs: confirm.dialog };
}
