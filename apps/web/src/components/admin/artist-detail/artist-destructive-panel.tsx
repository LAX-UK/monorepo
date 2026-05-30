"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminDeleteArtistResultAction, adminUpdateArtistResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import type { ArtistDeleteEligibility, ArtistProfile } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  artist: ArtistProfile;
  deleteEligibility: ArtistDeleteEligibility | null;
  canManageDelete: boolean;
};

export function ArtistDestructivePanel({ artist, deleteEligibility, canManageDelete }: Props) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canManageDelete) return null;

  if (artist.status === "merged_into" && artist.mergedIntoArtistId) {
    return (
      <section className="space-y-2 rounded-md border border-outline-variant/40 p-4">
        <h2 className="font-heading text-sm">Remove profile</h2>
        <p className="text-sm text-on-surface-variant">
          This profile was merged into another artist and cannot be deleted. Open the survivor
          profile to manage catalogue attribution.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/artists/${artist.mergedIntoArtistId}`}>Open survivor profile</Link>
        </Button>
      </section>
    );
  }

  const blockers = deleteEligibility?.blockers ?? [];
  const warnings = deleteEligibility?.warnings ?? [];
  const canDelete = deleteEligibility?.canDelete === true;
  const confirmationPhrase = deleteEligibility?.confirmationPhrase ?? "";
  const eligibilityUnavailable = deleteEligibility == null;

  async function archiveInstead() {
    const result = await adminUpdateArtistResultAction(artist.id, { archived: true });
    if (result.ok) {
      notify.success("Artist archived");
      router.refresh();
      return;
    }
    notify.error(result.error);
  }

  async function deleteProfile() {
    const result = await adminDeleteArtistResultAction(artist.id, {
      confirmationPhrase,
    });
    if (!result.ok) {
      notify.error(result.error);
      throw new Error(result.error);
    }
    notify.success("Artist deleted");
    router.push("/admin/artists");
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-md border border-outline-variant/40 p-4">
      <div>
        <h2 className="font-heading text-sm">Remove profile</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Permanently delete unused profiles, or archive profiles that still have catalogue
          footprint.
        </p>
      </div>

      {eligibilityUnavailable ? (
        <p className="text-sm text-on-surface-variant">
          Could not load delete eligibility. Refresh the page and try again.
        </p>
      ) : null}

      {blockers.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canDelete ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending || eligibilityUnavailable}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete profile…
          </Button>
        ) : null}
        {!artist.archived && blockers.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => void archiveInstead())}
          >
            Archive instead
          </Button>
        ) : null}
      </div>

      {canDelete ? (
        <TypedConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Confirm delete"
          description={`This permanently removes ${artist.displayName} from the registry. Type the phrase exactly (case-sensitive).`}
          actionLabel="Delete profile"
          confirmationPhrase={confirmationPhrase}
          severity="danger"
          onConfirm={() => deleteProfile()}
        />
      ) : null}
    </section>
  );
}
