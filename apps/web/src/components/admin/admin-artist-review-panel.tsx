"use client";

import { adminReviewArtistResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import type { ArtistStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { Textarea } from "@auction/ui/components/textarea";
import { CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type Props = {
  artistId: string;
  currentStatus: ArtistStatus | undefined;
};

export function AdminArtistReviewPanel({ artistId, currentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const notesFieldId = useId();
  const rejectionFieldId = useId();

  const isPending = currentStatus === "pending" || currentStatus === undefined;

  if (!isPending) {
    return (
      <Surface variant="card">
        <h3 className="font-display text-lg font-semibold text-on-surface">Review</h3>
        <div>
          <p className="text-sm text-on-surface-variant">
            This artist has already been reviewed (status:{" "}
            <span className="font-medium capitalize text-on-surface">{currentStatus}</span>). You
            can update the status from the edit form.
          </p>
        </div>
      </Surface>
    );
  }

  function submit(d: "approved" | "rejected") {
    setDecision(d);
    startTransition(async () => {
      const input: {
        decision: "approved" | "rejected";
        reviewNotes?: string;
        rejectionReason?: string;
      } = { decision: d };
      const trimmedNotes = notes.trim();
      if (trimmedNotes) input.reviewNotes = trimmedNotes;
      if (d === "rejected") {
        const rr = rejectionReason.trim();
        if (rr) input.rejectionReason = rr;
      }
      const result = await adminReviewArtistResultAction(artistId, input);
      if (result.ok) {
        notify.success(d === "approved" ? "Artist approved" : "Artist rejected");
        router.refresh();
      } else {
        notify.error(result.error);
      }
      setDecision(null);
    });
  }

  return (
    <Surface variant="card">
      <h3 className="font-display text-lg font-semibold text-on-surface">Review</h3>
      <div className="space-y-4">
        <p className="text-sm text-on-surface-variant">
          Approve to make this artist publicly visible and enable attribution. Reject to flag the
          profile as invalid.
        </p>

        <div>
          <label
            htmlFor={notesFieldId}
            className="mb-1 block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant"
          >
            Review notes (internal, optional)
          </label>
          <Textarea
            id={notesFieldId}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes visible only to staff…"
            disabled={pending}
          />
        </div>

        <div>
          <label
            htmlFor={rejectionFieldId}
            className="mb-1 block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant"
          >
            Rejection reason (sent to owner if rejected, optional)
          </label>
          <Textarea
            id={rejectionFieldId}
            rows={2}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason shown to the artist's account owner…"
            disabled={pending}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="default"
            disabled={pending}
            onClick={() => submit("approved")}
          >
            <CheckCircle className="size-4" aria-hidden />
            {pending && decision === "approved" ? "Approving…" : "Approve"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => submit("rejected")}
          >
            <XCircle className="size-4" aria-hidden />
            {pending && decision === "rejected" ? "Rejecting…" : "Reject"}
          </Button>
        </div>
      </div>
    </Surface>
  );
}
