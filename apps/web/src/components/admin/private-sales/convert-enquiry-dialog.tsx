"use client";

import { convertEnquiryAction } from "@/lib/actions/admin/admin-private-sales";
import { isStaleDeal } from "@/lib/admin/private-sales/private-sale-errors";
import { Field, Notice, StaffButton, StaffDialog, TextInput } from "@auction/staff-ui";
import { useEffect, useId, useRef, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
  /** A buy enquiry names the work it is about; a sell enquiry brings its own. */
  needsWork: boolean;
  onReload: () => void;
  onDone: (dealReference: string) => void;
  convert?: typeof convertEnquiryAction;
};

const WORK_REFERENCE = /^C-?\d{1,15}$/i;

/**
 * Turns a private sale enquiry into a proposed deal. A sell enquiry opens a draft consignment for
 * the work with the sender as seller; a buy enquiry names the work the buyer is being offered, by
 * its consignment reference. The sender needs an account, because the checks that gate the deal
 * are recorded against one, and the enquiry then belongs to its deal.
 */
export function ConvertEnquiryDialog({
  open,
  onOpenChange,
  reference,
  needsWork,
  onReload,
  onDone,
  convert = convertEnquiryAction,
}: Props) {
  const ids = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [work, setWork] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; stale: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setWork("");
    setAttempted(false);
    setFailure(null);
  }, [open]);

  const workError =
    attempted && needsWork && !WORK_REFERENCE.test(work.trim())
      ? "Enter the reference of the work, such as C-1042."
      : undefined;

  async function proceed() {
    setAttempted(true);
    if (needsWork && !WORK_REFERENCE.test(work.trim())) return;
    setFailure(null);
    setBusy(true);
    // A deal records its artwork or why it has none. A sell enquiry brings the seller's own work;
    // a buy enquiry's artwork is linked from the deal until the dialog can pick it.
    const result = await convert(
      reference,
      needsWork
        ? { workReference: work.trim(), notInRegister: { reason: "in_zoho_not_linked" } }
        : { notInRegister: { reason: "sellers_own_work" } },
    );
    setBusy(false);
    if (result.ok && result.data) {
      onOpenChange(false);
      onDone(result.data.reference);
    } else if (!result.ok) {
      setFailure({ message: result.error, stale: isStaleDeal(result.errorCode) });
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
      title={`Convert ${reference} to a deal`}
      description={
        needsWork
          ? "Opens a proposed deal for the buyer. The enquiry then belongs to the deal and can't be reopened."
          : "Opens a draft consignment for the work and a proposed deal with the sender as seller. The enquiry then belongs to the deal and can't be reopened."
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
            Convert to deal
          </StaffButton>
        </>
      }
    >
      <form
        id={`${ids}-form`}
        noValidate
        aria-label={`Convert ${reference} to a deal`}
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
              title="This enquiry changed"
              actions={
                <StaffButton size="sm" variant="secondary" onClick={onReload}>
                  Reload
                </StaffButton>
              }
            >
              Someone else changed this enquiry while you had it open. Reload to see their changes;
              nothing was converted.
            </Notice>
          ) : (
            <Notice tone="danger" alert title="The enquiry couldn't be converted">
              {failure.message}
            </Notice>
          )
        ) : null}
        {needsWork ? (
          <Field
            label="Work"
            id={`${ids}-work`}
            description="The consignment reference of the work this buyer is asking about."
            error={workError}
            disabled={busy}
          >
            <TextInput
              value={work}
              placeholder="C-1042"
              autoComplete="off"
              onChange={(event) => setWork(event.target.value)}
            />
          </Field>
        ) : (
          <p className="m-0 text-staff-sm text-staff-muted">
            No more details are needed. Photos and documents stay on the enquiry.
          </p>
        )}
      </form>
    </StaffDialog>
  );
}
