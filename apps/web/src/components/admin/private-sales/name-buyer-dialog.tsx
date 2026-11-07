"use client";

import { PlatformUserPicker } from "@/components/admin/staff/platform-user-picker";
import { nameDealBuyerAction } from "@/lib/actions/admin/admin-private-sales";
import type { DealRecord } from "@/lib/data/http/admin-private-sales.schema";
import { Field, StaffButton, StaffDialog } from "@auction/staff-ui";
import { useEffect, useId, useRef, useState } from "react";
import { type DealWriteFailure, FailureNotice, dealFailureOf } from "./deal-action-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealRecord;
  onReload: () => void;
  onDone: (deal: DealRecord) => void;
  nameBuyer?: typeof nameDealBuyerAction;
};

/**
 * Names the person who acts for the buyer, from the client accounts. They act for their own
 * account; an organisation's deal starts from the enquiry the organisation sent. The buyer can be
 * changed until the price is agreed, and a new buyer accepts the terms afresh.
 */
export function NameBuyerDialog({
  open,
  onOpenChange,
  deal,
  onReload,
  onDone,
  nameBuyer = nameDealBuyerAction,
}: Props) {
  const ids = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [buyerUserId, setBuyerUserId] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<DealWriteFailure | null>(null);

  useEffect(() => {
    if (!open) return;
    setBuyerUserId(null);
    setAttempted(false);
    setFailure(null);
  }, [open]);

  const missing = attempted && buyerUserId === null;

  async function save() {
    setAttempted(true);
    if (buyerUserId === null) return;
    setFailure(null);
    setBusy(true);
    const result = await nameBuyer(deal.reference, { version: deal.version, buyerUserId });
    setBusy(false);
    if (result.ok && result.data) {
      onOpenChange(false);
      onDone(result.data);
    } else if (!result.ok) {
      setFailure(dealFailureOf(result));
    }
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="md"
      initialFocusRef={cancelRef}
      title={
        deal.buyer ? `Change the buyer · ${deal.reference}` : `Name the buyer · ${deal.reference}`
      }
      description={
        deal.buyer
          ? "The new buyer has to accept the terms and be cleared. The seller isn't told who the buyer is."
          : "The buyer needs a client account, because their identity and funds are checked against it."
      }
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
            {deal.buyer ? "Change buyer" : "Name buyer"}
          </StaffButton>
        </>
      }
    >
      <form
        id={`${ids}-form`}
        noValidate
        aria-label="Name the buyer"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {failure ? (
          <FailureNotice
            failure={failure}
            title="The buyer couldn't be named"
            onReload={onReload}
          />
        ) : null}
        <Field
          label="Buyer"
          id={`${ids}-buyer`}
          description="Search the client accounts by name or email."
          error={missing ? "Choose the buyer from the search results." : undefined}
          disabled={busy}
        >
          <PlatformUserPicker
            id={`${ids}-buyer`}
            value={buyerUserId}
            onValueChange={(option) => setBuyerUserId(option?.id ?? null)}
            invalid={missing}
            disabled={busy}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
