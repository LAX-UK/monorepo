"use client";

import { ArtistSearch, type ArtistSearchHit } from "@/components/artists/artist-search";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminMergeArtistResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Textarea } from "@auction/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  fromArtistId: string;
  fromDisplayName: string;
};

export function AdminArtistMergePanel({ fromArtistId, fromDisplayName }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState<ArtistSearchHit | null>(null);
  const [reason, setReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const phrase = target ? `MERGE INTO ${target.displayName}` : "";
  const reasonOk = reason.trim().length >= 10;
  const canProceed =
    target !== null && target.id !== fromArtistId && reasonOk && target.status !== "merged_into";

  return (
    <section className="space-y-4 rounded-md border border-outline-variant/40 p-4">
      <div>
        <h2 className="font-heading text-lg">Merge duplicate artist</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Moves aliases and lots from <strong>{fromDisplayName}</strong> into the surviving profile.
          This cannot be undone from the UI.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Surviving artist (canonical)</p>
        <ArtistSearch
          placeholder="Search for the artist profile to keep…"
          onSelect={(hit) => setTarget(hit)}
          disabled={pending}
        />
        {target ? (
          <p className="text-sm text-on-surface-variant">
            Selected: <span className="font-medium text-on-surface">{target.displayName}</span> (
            {target.id})
            {target.id === fromArtistId ? (
              <span className="ml-2 text-destructive">Choose a different artist than this one.</span>
            ) : null}
            {target.status === "merged_into" ? (
              <span className="ml-2 text-destructive">
                This profile is already merged; pick the canonical artist instead.
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      <label className="block space-y-1 text-sm">
        <span>Reason (min 10 characters)</span>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why these profiles should be merged…"
          rows={3}
          disabled={pending}
        />
      </label>

      <Button
        type="button"
        variant="destructive"
        disabled={!canProceed || pending}
        onClick={() => setDialogOpen(true)}
      >
        Merge into selected artist…
      </Button>

      <TypedConfirmationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Confirm artist merge"
        description={`Every reference to ${fromDisplayName} will point to the surviving artist.`}
        actionLabel="Merge artists"
        confirmationPhrase={phrase}
        severity="danger"
        onConfirm={() => {
          if (!target) return;
          startTransition(async () => {
            const result = await adminMergeArtistResultAction(fromArtistId, {
              intoArtistId: target.id,
              reason: reason.trim(),
              confirmationPhrase: phrase,
            });
            if (result.ok && result.data?.remainingId) {
              notify.success("Artists merged");
              router.push(`/admin/artists/${result.data.remainingId}/edit`);
              router.refresh();
              return;
            }
            if (!result.ok) notify.error(result.error);
          });
        }}
      />
    </section>
  );
}
