"use client";

import { waiveLotStorageAction } from "@/lib/actions/admin/admin-collection-overdue";
import { NOT_COLLECTED_COPY } from "@/lib/admin/collections/not-collected-copy";
import { validateWaiveReason } from "@/lib/admin/collections/not-collected.vm";
import {
  Field,
  Notice,
  StaffButton,
  StaffDialog,
  TextArea,
  UnsavedChangesGuard,
  confirmDiscardChanges,
} from "@auction/staff-ui";
import type { StaffOverdueLots } from "@auction/types";
import { useId, useState } from "react";
import { type OverdueFailure, useOverdueChange } from "./use-overdue-change";

const C = NOT_COLLECTED_COPY.waive;

type Props = {
  venueId: string;
  lotId: string;
  lotLine: string;
  /** "£42.00": what has built up so far. */
  amount: string;
  onClose: () => void;
  onSaved: (lots: StaffOverdueLots) => void;
};

/**
 * Waive one lot's storage charges, with the reason. One field, so a failed submit focuses it and
 * shows its inline error, with no summary (the storage terms design's exception to FRM-4). Finance
 * only; the API asks for a recent sign-in, and a stale one sends the person to sign in again.
 */
export function WaiveStorageDialog({ venueId, lotId, lotLine, amount, onClose, onSaved }: Props) {
  const ids = useId();
  const formId = `${ids}-form`;
  const reasonId = `${ids}-reason`;
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<OverdueFailure | null>(null);
  const change = useOverdueChange();
  const dirty = reason !== "";
  const error = attempted ? validateWaiveReason(reason) : undefined;

  async function submit() {
    if (change.busy) return;
    setAttempted(true);
    if (validateWaiveReason(reason)) {
      document.getElementById(reasonId)?.focus();
      return;
    }
    const outcome = await change.run(() =>
      waiveLotStorageAction(venueId, lotId, { reason: reason.trim() }),
    );
    if (outcome.ok) {
      onSaved(outcome.lots);
      return;
    }
    setFailure(outcome.failure);
  }

  async function close() {
    if (change.busy) return;
    if (!dirty || (await confirmDiscardChanges())) onClose();
  }

  return (
    <StaffDialog
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
      size="md"
      title={C.title}
      description={C.description(lotLine)}
      footer={
        <>
          <StaffButton
            type="button"
            variant="secondary"
            disabled={change.busy}
            onClick={() => void close()}
          >
            {C.cancel}
          </StaffButton>
          <StaffButton type="submit" form={formId} variant="danger" loading={change.busy}>
            {C.submit}
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={C.title}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <UnsavedChangesGuard dirty={dirty && !change.busy} label={C.dirtyLabel} />
        {failure ? (
          <Notice tone="danger" alert title={NOT_COLLECTED_COPY.failed}>
            {failure.message}
          </Notice>
        ) : null}
        <Notice tone="warning" quiet title={C.effect(amount)}>
          {null}
        </Notice>
        <Field
          id={reasonId}
          label={C.reasonLabel}
          description={C.reasonHint}
          error={error}
          disabled={change.busy}
        >
          <TextArea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
