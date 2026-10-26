"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { adminDeleteArtistResultAction, adminUpdateArtistResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import type { OverflowAction } from "@auction/staff-ui";
import type { ArtistDeleteEligibility } from "@auction/types";
import { Archive, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

type Args = {
  artistId: string;
  displayName: string;
  archived: boolean;
  deleteEligibility: ArtistDeleteEligibility | null;
  canManageDelete: boolean;
  /** A merged profile is managed on the profile it was merged into. */
  merged: boolean;
};

/**
 * The artist page's state-changing actions: archive a profile that still has catalogue
 * footprint (undoable from the toast), and delete one nothing refers to. Deleting asks first
 * through the kit confirm. The API's delete phrase comes from the eligibility check, so people
 * confirm the action itself rather than copy a phrase.
 */
export function useArtistActions({
  artistId,
  displayName,
  archived,
  deleteEligibility,
  canManageDelete,
  merged,
}: Args) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const { ask } = confirm;
  const blockers = deleteEligibility?.blockers ?? [];
  const warnings = deleteEligibility?.warnings ?? [];
  const canDelete = deleteEligibility?.canDelete === true;
  const phrase = deleteEligibility?.confirmationPhrase ?? "";

  const setArchived = useCallback(
    async (next: boolean) => {
      const result = await adminUpdateArtistResultAction(artistId, { archived: next });
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.success(next ? `${displayName} archived` : `${displayName} restored`, {
        ...(next ? { action: { label: "Undo", onClick: () => void setArchived(false) } } : {}),
      });
      router.refresh();
    },
    [artistId, displayName, router],
  );

  const remove = useCallback(
    () =>
      ask({
        title: `Delete ${displayName}?`,
        description: (
          <>
            The profile and its aliases are removed from the registry. This cannot be undone.
            {warnings.length > 0 ? ` ${warnings.join(" ")}` : ""}
          </>
        ),
        confirmLabel: "Delete artist",
        cancelLabel: "Keep artist",
        tone: "danger",
        run: () => adminDeleteArtistResultAction(artistId, { confirmationPhrase: phrase }),
        success: `${displayName} deleted`,
        onSuccess: () => {
          router.push("/admin/artists");
          router.refresh();
        },
      }),
    [ask, artistId, displayName, phrase, router, warnings],
  );

  const items: OverflowAction[] = [];
  if (canManageDelete && !merged) {
    if (!archived && blockers.length > 0) {
      items.push({
        id: "archive",
        label: "Archive artist",
        icon: Archive,
        onSelect: () => void setArchived(true),
      });
    }
    items.push({
      id: "delete",
      label: "Delete artist",
      icon: Trash2,
      tone: "danger",
      onSelect: remove,
      ...(deleteEligibility == null
        ? { disabledReason: "Could not check whether this artist can be deleted. Reload the page." }
        : !canDelete
          ? { disabledReason: blockers[0] ?? "This artist cannot be deleted" }
          : {}),
    });
  }

  return { items, dialogs: confirm.dialog };
}
