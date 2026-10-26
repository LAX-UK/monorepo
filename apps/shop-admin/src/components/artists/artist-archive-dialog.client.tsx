"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { setArtistArchived } from "@/server/application/admin-artwork-actions.server";
import { ConfirmActionDialog, Notice, toast } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ArtistArchiveTarget = {
  artistId: string;
  displayName: string;
  archived: boolean;
  /** Live works block archiving; unknown in the list, where the API's refusal names them. */
  liveArtworkCount?: number;
};

function archiveDescription(target: ArtistArchiveTarget): string {
  if (target.archived) {
    return "They return to the artist directories on LAX Shop and lax.art, and their artworks can be published again.";
  }
  const live = target.liveArtworkCount ?? 0;
  if (live > 0) {
    return `${live === 1 ? "One of their artworks is" : `${live} of their artworks are`} live. Unpublish or archive ${live === 1 ? "it" : "them"} first; archiving is refused until then.`;
  }
  return "They leave the artist directories on LAX Shop and lax.art. Their artworks, editions and sales stay on record, and you can restore them later. An artist with live artworks cannot be archived.";
}

/**
 * Archive or restore one artist, from the list's row menu or the artist's page. Archiving is
 * refused while any of their artworks is live; the API says so and the dialog keeps the reason.
 */
export function ArtistArchiveDialog({
  target,
  onClose,
}: {
  target: ArtistArchiveTarget | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(current: ArtistArchiveTarget) {
    setSaving(true);
    setError(null);
    const result = await setArtistArchived({
      artistId: current.artistId,
      archived: !current.archived,
      idempotencyKey: crypto.randomUUID(),
    }).catch(() => ({ ok: false, kind: "failed", message: "Action failed. Try again." }) as const);
    setSaving(false);
    if (!result.ok) {
      setError(adminMutationErrorMessage(result));
      return;
    }
    toast.success(
      current.archived ? `Restored ${current.displayName}` : `Archived ${current.displayName}`,
    );
    onClose();
    router.refresh();
  }

  return (
    <ConfirmActionDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !saving) {
          setError(null);
          onClose();
        }
      }}
      title={
        target
          ? target.archived
            ? `Restore ${target.displayName}?`
            : `Archive ${target.displayName}?`
          : ""
      }
      description={target ? archiveDescription(target) : ""}
      confirmLabel={target?.archived ? "Restore artist" : "Archive artist"}
      tone={target?.archived ? "default" : "danger"}
      loading={saving}
      onConfirm={() => {
        if (target) void apply(target);
      }}
    >
      {error ? <Notice tone="danger" alert title={error} /> : null}
    </ConfirmActionDialog>
  );
}
