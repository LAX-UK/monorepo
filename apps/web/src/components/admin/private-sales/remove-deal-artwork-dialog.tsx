"use client";

import { removeDealArtworkAction } from "@/lib/actions/admin/admin-private-sales";
import { isStaleDeal } from "@/lib/admin/private-sales/private-sale-errors";
import type { DealRecord } from "@/lib/data/http/admin-private-sales.schema";
import {
  ChoiceFieldset,
  ChoiceRow,
  Field,
  Notice,
  StaffButton,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
} from "@auction/staff-ui";
import type { PrivateSaleArtworkUnlinkedReason } from "@auction/types";
import { useEffect, useId, useRef, useState } from "react";
import { UNLINKED_REASONS } from "./artwork-choice";

/** Taking the artwork off usually means it still has to be linked, so that reason comes first. */
const REMOVE_REASONS = [...UNLINKED_REASONS].sort(
  (a, b) => Number(b.reason === "in_zoho_not_linked") - Number(a.reason === "in_zoho_not_linked"),
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealRecord;
  onReload: () => void;
  onDone: () => void;
  remove?: typeof removeDealArtworkAction;
};

/**
 * Takes the artwork off a deal that is still being offered, and releases it in the register in the
 * same step. Staff say why the deal has no register artwork afterwards: the deal can't be agreed
 * until one is linked again, unless it is the seller's own work. The effect is stated first.
 */
export function RemoveDealArtworkDialog({
  open,
  onOpenChange,
  deal,
  onReload,
  onDone,
  remove = removeDealArtworkAction,
}: Props) {
  const ids = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [why, setWhy] = useState<PrivateSaleArtworkUnlinkedReason>("in_zoho_not_linked");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; stale: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setWhy("in_zoho_not_linked");
    setNote("");
    setFailure(null);
  }, [open]);

  const current = deal.artwork?.title ?? "the artwork";

  async function proceed() {
    setFailure(null);
    setBusy(true);
    const result = await remove(deal.reference, {
      version: deal.version,
      notInRegister: { reason: why },
      ...(note.trim() ? { reason: note.trim() } : {}),
    });
    setBusy(false);
    if (result.ok) {
      onOpenChange(false);
      onDone();
      return;
    }
    setFailure({ message: result.error, stale: isStaleDeal(result.errorCode) });
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="md"
      initialFocusRef={cancelRef}
      title={`Remove the artwork from ${deal.reference}?`}
      description={`Releases ${current}. It shows as Withdrawn for 30 days and can be offered again.`}
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={`${ids}-form`} variant="primary" loading={busy}>
            Remove and release
          </StaffButton>
        </>
      }
    >
      <form
        id={`${ids}-form`}
        noValidate
        aria-label={`Remove the artwork from ${deal.reference}`}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void proceed();
        }}
      >
        {failure ? (
          failure.stale ? (
            <Notice
              tone="warning"
              alert
              title="This private sale changed"
              actions={
                <StaffButton size="sm" variant="secondary" onClick={onReload}>
                  Reload
                </StaffButton>
              }
            >
              Someone else changed this deal while you had it open. Reload to see their changes;
              nothing was changed.
            </Notice>
          ) : (
            <Notice tone="danger" alert title="The artwork couldn't be removed">
              {failure.message}
            </Notice>
          )
        ) : null}
        <ChoiceFieldset id={`${ids}-why`} legend="Why" disabled={busy}>
          <StaffRadioGroup
            aria-label="Why the deal has no register artwork"
            className="grid-cols-[minmax(0,1fr)]"
            value={why}
            onValueChange={(next) => setWhy(next as PrivateSaleArtworkUnlinkedReason)}
          >
            {REMOVE_REASONS.map(({ reason, label, hint }) => (
              <ChoiceRow
                key={reason}
                htmlFor={`${ids}-${reason}`}
                control={<StaffRadio id={`${ids}-${reason}`} value={reason} />}
                label={label}
                description={
                  reason === "in_zoho_not_linked"
                    ? "The deal can't be agreed until an artwork is linked again."
                    : hint
                }
              />
            ))}
          </StaffRadioGroup>
        </ChoiceFieldset>
        <Field
          label="Note"
          id={`${ids}-note`}
          description="Shown in the deal's history."
          optional
          disabled={busy}
        >
          <TextArea
            rows={3}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
