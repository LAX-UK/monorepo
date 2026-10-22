"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  parseWholeNumber,
  requiredText,
} from "@/lib/form-validation";
import { decideSaleAuthorityRequest } from "@/server/application/admin-people-actions.server";
import { Button, ConfirmDialog } from "@auction/ui";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { TextAreaField, TextField } from "../fields";

export function DecideSaleAuthorityRequestForm({
  requestId,
  requestedCount,
  artworkTitle,
  ownerDisplayName,
}: {
  requestId: string;
  requestedCount: number;
  artworkTitle: string;
  ownerDisplayName: string;
}) {
  const mutation = useAdminMutation();
  const [authorisedCount, setAuthorisedCount] = useState(String(requestedCount));
  const [evidenceNote, setEvidenceNote] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmingDecline, setConfirmingDecline] = useState(false);

  function approve() {
    const count = parseWholeNumber(
      authorisedCount,
      { min: 0, max: 10 },
      "Authorised count must be a whole number from 0 to 10.",
    );
    const next = collectFieldErrors({
      authorisedCount: count.ok ? null : count.message,
      evidenceNote: requiredText(evidenceNote, "Enter an evidence note to approve."),
    });
    setErrors(next);
    if (hasFieldErrors(next) || !count.ok) return;
    void mutation.run(
      () =>
        decideSaleAuthorityRequest({
          requestId,
          decision: "approve",
          authorisedCount: count.value,
          evidenceNote: evidenceNote.trim(),
          idempotencyKey: mutation.idempotencyKey,
        }),
      "Request approved",
    );
  }

  function askToDecline() {
    const next = collectFieldErrors({
      declineReason: requiredText(declineReason, "Enter a decline reason to decline."),
    });
    setErrors(next);
    if (!hasFieldErrors(next)) setConfirmingDecline(true);
  }

  return (
    <>
      <AdminForm
        title={`Review ${artworkTitle}`}
        mutation={mutation}
        errors={errors}
        submitLabel="Approve"
        onSubmit={approve}
        secondaryAction={
          <Button
            type="button"
            variant="outline"
            disabled={mutation.pending}
            onClick={askToDecline}
          >
            Decline
          </Button>
        }
      >
        <TextField
          name="authorisedCount"
          label="Authorised count (0–10)"
          type="number"
          min={0}
          max={10}
          value={authorisedCount}
          error={errors.authorisedCount}
          disabled={mutation.pending}
          onChange={setAuthorisedCount}
        />
        <TextAreaField
          name="evidenceNote"
          label="Evidence note (required to approve)"
          className="sm:col-span-2"
          rows={2}
          value={evidenceNote}
          error={errors.evidenceNote}
          disabled={mutation.pending}
          onChange={setEvidenceNote}
        />
        <TextAreaField
          name="declineReason"
          label="Decline reason (required to decline)"
          className="sm:col-span-2"
          rows={2}
          value={declineReason}
          error={errors.declineReason}
          disabled={mutation.pending}
          onChange={setDeclineReason}
        />
      </AdminForm>
      <ConfirmDialog
        open={confirmingDecline}
        onOpenChange={setConfirmingDecline}
        title={`Decline ${ownerDisplayName}'s request`}
        body={`The request for ${artworkTitle} is declined with your reason. This cannot be undone; ${ownerDisplayName} would need to submit a new request.`}
        confirmLabel="Decline request"
        loading={mutation.pending}
        onConfirm={async () => {
          await mutation.run(
            () =>
              decideSaleAuthorityRequest({
                requestId,
                decision: "decline",
                declineReason: declineReason.trim(),
                idempotencyKey: mutation.idempotencyKey,
              }),
            "Request declined",
          );
          setConfirmingDecline(false);
        }}
      />
    </>
  );
}
