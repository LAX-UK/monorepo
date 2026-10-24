"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { setArtistArchived } from "@/server/application/admin-artwork-actions.server";
import {
  ConfirmActionDialog,
  OverflowMenu,
  StaffButton,
  type StaffLinkComponent,
  toast,
} from "@auction/staff-ui";
import { Archive, ArchiveRestore, Plus } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NextLink: StaffLinkComponent = Link;

/**
 * The artist page's actions: a new artwork for this artist, and archive or restore. Archiving is
 * refused while any of the artist's artworks is live; the API says which, and so does the toast.
 */
export function ArtistHeaderActions({
  artistId,
  displayName,
  archived,
  liveArtworkCount,
}: {
  artistId: string;
  displayName: string;
  archived: boolean;
  liveArtworkCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  async function apply() {
    setSaving(true);
    const result = await setArtistArchived({
      artistId,
      archived: !archived,
      idempotencyKey: crypto.randomUUID(),
    }).catch(() => ({ ok: false, kind: "failed", message: "Action failed. Try again." }) as const);
    setSaving(false);
    setConfirming(false);
    if (!result.ok) {
      toast.error(adminMutationErrorMessage(result));
      return;
    }
    toast.success(archived ? `Restored ${displayName}` : `Archived ${displayName}`);
    router.refresh();
  }

  return (
    <>
      <OverflowMenu
        Link={NextLink}
        actions={[
          archived
            ? {
                id: "restore",
                label: "Restore artist",
                icon: ArchiveRestore,
                onSelect: () => setConfirming(true),
              }
            : {
                id: "archive",
                label: "Archive artist",
                icon: Archive,
                tone: "danger" as const,
                onSelect: () => setConfirming(true),
              },
        ]}
      />
      {archived ? null : (
        <StaffButton asChild variant="primary" icon={<Plus aria-hidden />}>
          <Link href={`/artworks/new?artist=${artistId}`}>New artwork</Link>
        </StaffButton>
      )}
      <ConfirmActionDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={archived ? `Restore ${displayName}?` : `Archive ${displayName}?`}
        description={
          archived
            ? "They return to the artist directories, and their artworks can be published again."
            : liveArtworkCount > 0
              ? `${liveArtworkCount === 1 ? "One of their artworks is" : `${liveArtworkCount} of their artworks are`} live. Unpublish or archive ${liveArtworkCount === 1 ? "it" : "them"} first; archiving will be refused until then.`
              : "They leave both storefronts' artist directories. Their artworks, editions and sales stay on record, and you can restore them later."
        }
        confirmLabel={archived ? "Restore" : "Archive"}
        tone={archived ? "default" : "danger"}
        loading={saving}
        onConfirm={() => void apply()}
      />
    </>
  );
}
