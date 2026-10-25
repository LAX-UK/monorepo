"use client";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import { decideSaleAuthorityRequest } from "@/server/application/admin-people-actions.server";
import {
  AUTHORISED_COUNT_OPTIONS,
  checkApproveRequest,
  grantButtonLabel,
  requestedEditionsLabel,
} from "@/server/domain/sale-authority.vm";
import {
  type AdminSaleAuthorityRequestList,
  SALE_AUTHORITY_NOTE_MAX_LENGTH,
} from "@auction/shop-contracts";
import { ConfirmActionDialog, EnumSelect, Field, KeyValueList, TextArea } from "@auction/staff-ui";
import { useState } from "react";

export type SaleRequestRow = AdminSaleAuthorityRequestList["items"][number];

/**
 * Approve a sale limit request: the number of editions starts at what the owner asked for and
 * is chosen from the allowed range, and the evidence is kept in the audit log. Checked on
 * submit, then again as each field changes.
 */
export function ApproveRequestDialog({
  request,
  onClose,
}: {
  request: SaleRequestRow;
  onClose: () => void;
}) {
  const action = useAdminAction();
  const [count, setCount] = useState<string | null>(String(request.requestedCount));
  const [evidenceNote, setEvidenceNote] = useState("");
  const [submits, setSubmits] = useState(0);
  const checked = checkApproveRequest({ count, evidenceNote });
  const errors = submits > 0 && !checked.ok ? checked.errors : {};

  const submit = async () => {
    setSubmits((value) => value + 1);
    if (!checked.ok) return;
    const { authorisedCount, evidenceNote: note } = checked.body;
    const ok = await action.run(
      () =>
        decideSaleAuthorityRequest({
          requestId: request.requestId,
          decision: "approve",
          authorisedCount,
          evidenceNote: note,
          idempotencyKey: action.idempotencyKey,
        }),
      `${request.ownerDisplayName} may now sell ${authorisedCount === 1 ? "1 edition" : `${authorisedCount} editions`} of ${request.artworkTitle}`,
      "approve this request",
    );
    if (ok) onClose();
  };

  return (
    <>
      <StaffFormDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`Approve ${request.ownerDisplayName}’s request?`}
        description={`${request.ownerDisplayName} will be able to sell this many editions of ${request.artworkTitle}. The approval is audited with your evidence.`}
        submitLabel={grantButtonLabel(count === null ? null : Number(count))}
        pending={action.pending}
        onSubmit={() => void submit()}
      >
        <KeyValueList
          items={[
            { label: "Request", value: requestedEditionsLabel(request.requestedCount) },
            ...(request.note ? [{ label: "Their note", value: request.note }] : []),
          ]}
        />
        {action.error}
        <Field label="Editions they may sell" error={errors.count}>
          <EnumSelect value={count} onValueChange={setCount} options={AUTHORISED_COUNT_OPTIONS} />
        </Field>
        <Field
          label="Evidence"
          description="What the approval is based on, such as a signed agreement. Kept in the audit log."
          error={errors.evidenceNote}
        >
          <TextArea
            rows={3}
            maxLength={SALE_AUTHORITY_NOTE_MAX_LENGTH}
            value={evidenceNote}
            onChange={(event) => setEvidenceNote(event.target.value)}
          />
        </Field>
      </StaffFormDialog>
      {action.stepUpDialog}
    </>
  );
}

/**
 * Decline a sale limit request with a reason the owner reads in LAX Account. Declining cannot
 * be undone; the owner can send a new request.
 */
export function DeclineRequestDialog({
  request,
  onClose,
}: {
  request: SaleRequestRow;
  onClose: () => void;
}) {
  const action = useAdminAction();
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`Decline ${request.ownerDisplayName}’s request?`}
        description={`The request to sell editions of ${request.artworkTitle} is declined. This cannot be undone; ${request.ownerDisplayName} can send a new request.`}
        confirmLabel="Decline request"
        tone="danger"
        loading={action.pending}
        reason={{
          label: "Reason",
          description: `${request.ownerDisplayName} sees this in LAX Account. Say what would change the answer.`,
          maxLength: SALE_AUTHORITY_NOTE_MAX_LENGTH,
          missingMessage: "Enter the reason the owner will see.",
        }}
        onConfirm={async ({ reason }) => {
          const ok = await action.run(
            () =>
              decideSaleAuthorityRequest({
                requestId: request.requestId,
                decision: "decline",
                declineReason: reason,
                idempotencyKey: action.idempotencyKey,
              }),
            `Request from ${request.ownerDisplayName} declined`,
            "decline this request",
          );
          if (ok) onClose();
        }}
      >
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}
