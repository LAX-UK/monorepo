"use client";

import {
  adminApproveSubmissionResultAction,
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
import { CheckCircle, PlayCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type Props = {
  submissionId: string;
  status: ItemSubmissionStatus;
};

export function SubmissionInlineActions({ submissionId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const approveNotesFieldId = useId();
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

  function approve() {
    startTransition(async () => {
      const result = await adminApproveSubmissionResultAction(submissionId, {
        reviewNotes: reviewNotes.trim() || undefined,
      });
      if (result.ok) {
        notify.success("Submission approved — draft lot created");
        setApproveOpen(false);
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

  if (status === "submitted") {
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
    return (
      <div className="flex flex-wrap gap-2">
        <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" disabled={pending}>
              <CheckCircle className="size-3.5" aria-hidden />
              Approve
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve submission</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-on-surface-variant">
              This will create a draft lot. You can assign the artist on the lot detail page after
              approval.
            </p>
            <label htmlFor={approveNotesFieldId} className="flex flex-col gap-1.5">
              <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Internal notes (optional)
              </span>
              <Textarea
                id={approveNotesFieldId}
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Internal notes…"
                disabled={pending}
              />
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={approve} disabled={pending}>
                {pending ? "Approving…" : "Approve"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
      </div>
    );
  }

  return null;
}
