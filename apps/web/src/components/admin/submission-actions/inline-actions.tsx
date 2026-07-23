"use client";

import {
  adminAcceptSubmissionResultAction,
  adminRejectSubmissionResultAction,
  adminStartSubmissionReviewResultAction,
} from "@/lib/actions/admin-submissions";
import { notify } from "@/lib/ui/notify";
import type { ItemSubmissionStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@auction/ui/components/dialog";
import { Textarea } from "@auction/ui/components/textarea";
import { ArrowRight, CheckCircle, PlayCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type Props = {
  submissionId: string;
  status: ItemSubmissionStatus;
  variant?: "full" | "accept-only" | "reject-only";
};

export function SubmissionInlineActions({ submissionId, status, variant = "full" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const acceptNotesFieldId = useId();
  const rejectReasonFieldId = useId();

  function startReview() {
    startTransition(async () => {
      const result = await adminStartSubmissionReviewResultAction(submissionId);
      if (result.ok) {
        notify.success("Moved to under review");
        router.refresh();
      } else {
        notify.error(result.error);
      }
    });
  }

  function acceptForCataloguing() {
    startTransition(async () => {
      const result = await adminAcceptSubmissionResultAction(submissionId, {
        reviewNotes: reviewNotes.trim() || undefined,
      });
      if (result.ok) {
        notify.success("Accepted for cataloguing");
        setAcceptOpen(false);
        router.refresh();
      } else {
        notify.error(result.error);
      }
    });
  }

  function reject() {
    if (!rejectionReason.trim()) {
      notify.error("Please provide a rejection reason");
      return;
    }
    startTransition(async () => {
      const result = await adminRejectSubmissionResultAction(submissionId, {
        rejectionReason: rejectionReason.trim(),
        reviewNotes: reviewNotes.trim() || undefined,
      });
      if (result.ok) {
        notify.success("Submission rejected");
        setRejectOpen(false);
        router.refresh();
      } else {
        notify.error(result.error);
      }
    });
  }

  const acceptDialog = (
    <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" disabled={pending}>
          <CheckCircle className="size-3.5" aria-hidden />
          Accept
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept for cataloguing</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-on-surface-variant">
          Moves this submission to accepted. Create the draft lot from the decision tab with an
          artist assignment.
        </p>
        <label htmlFor={acceptNotesFieldId} className="flex flex-col gap-1.5">
          <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Internal notes (optional)
          </span>
          <Textarea
            id={acceptNotesFieldId}
            rows={3}
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Internal notes…"
            disabled={pending}
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAcceptOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={acceptForCataloguing} disabled={pending}>
            {pending ? "Accepting…" : "Save & Accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const rejectDialog = (
    <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm" disabled={pending}>
          <XCircle className="size-3.5" aria-hidden />
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject submission</DialogTitle>
        </DialogHeader>
        <label htmlFor={rejectReasonFieldId} className="flex flex-col gap-1.5">
          <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Rejection reason (required, shown to seller)
          </span>
          <Textarea
            id={rejectReasonFieldId}
            rows={4}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection…"
            disabled={pending}
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={reject} disabled={pending}>
            {pending ? "Rejecting…" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (status === "submitted") {
    if (variant === "reject-only") return null;
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={startReview}>
          <PlayCircle className="size-3.5" aria-hidden />
          Start review
        </Button>
      </div>
    );
  }

  if (status === "under_review") {
    if (variant === "accept-only") return acceptDialog;
    if (variant === "reject-only") return rejectDialog;
    return (
      <div className="flex flex-wrap gap-2">
        {acceptDialog}
        {rejectDialog}
      </div>
    );
  }

  if (status === "approved") {
    if (variant === "reject-only") return null;
    return (
      <Button type="button" variant="outline" size="sm" asChild>
        <Link href={`/admin/submissions/${submissionId}/decision`}>
          Convert to lot
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    );
  }

  return null;
}
