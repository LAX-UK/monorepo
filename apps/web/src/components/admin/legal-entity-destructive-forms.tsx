"use client";

import {
  legalEntityArchiveAction,
  legalEntityRejectAction,
} from "@/lib/admin/legal-entity-lifecycle.actions";
import { Button } from "@auction/ui/components/button";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";
import { useState, useTransition } from "react";
import { TypedConfirmationDialog } from "./typed-confirmation-dialog";

function archivePhrase(displayName: string): string {
  return `ARCHIVE ${displayName}`;
}

type RejectProps = {
  legalEntityId: string;
};

export function LegalEntityRejectForm({ legalEntityId }: RejectProps) {
  const [reason, setReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("legalEntityId", legalEntityId);
      fd.set("reason", reason);
      fd.set("confirmationPhrase", "REJECT");
      await legalEntityRejectAction(fd);
    });
  }

  return (
    <>
      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`reject-reason-${legalEntityId}`}>Reason</Label>
          <Textarea
            id={`reject-reason-${legalEntityId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            maxLength={4000}
            rows={4}
            placeholder="Explain why this entity is rejected."
          />
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending || reason.trim().length < 3}
          onClick={() => setDialogOpen(true)}
        >
          Reject entity…
        </Button>
      </div>
      <TypedConfirmationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Confirm rejection"
        description="This sets the entity to rejected. Type REJECT exactly (case-sensitive)."
        actionLabel="Reject entity"
        confirmationPhrase="REJECT"
        severity="danger"
        onConfirm={() => submit()}
      />
    </>
  );
}

type ArchiveProps = {
  legalEntityId: string;
  displayName: string;
};

export function LegalEntityArchiveForm({ legalEntityId, displayName }: ArchiveProps) {
  const [reason, setReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const phrase = archivePhrase(displayName);

  function submit() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("legalEntityId", legalEntityId);
      fd.set("reason", reason);
      fd.set("confirmationPhrase", phrase);
      await legalEntityArchiveAction(fd);
    });
  }

  return (
    <>
      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`archive-reason-${legalEntityId}`}>Reason</Label>
          <Textarea
            id={`archive-reason-${legalEntityId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            maxLength={4000}
            rows={4}
            placeholder="Audit reason for archive."
          />
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending || reason.trim().length < 3}
          onClick={() => setDialogOpen(true)}
        >
          Archive entity…
        </Button>
      </div>
      <TypedConfirmationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Confirm archive"
        description="Permanent terminal state. Type the phrase exactly (case-sensitive), including spaces."
        actionLabel="Archive entity"
        confirmationPhrase={phrase}
        severity="danger"
        onConfirm={() => submit()}
      />
    </>
  );
}
