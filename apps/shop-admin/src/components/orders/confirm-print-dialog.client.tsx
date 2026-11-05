"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { confirmPrint } from "@/server/application/print-fulfilment-actions.server";
import {
  CONFIRM_FIELD_EMPTY,
  CONFIRM_FIELD_HELP,
  CONFIRM_FIELD_LABEL,
  type ConfirmNotice,
  type PackRowView,
  confirmNotice,
  scanSource,
} from "@/server/domain/pick-and-pack.vm";
import { PRINT_SCAN_MAX_LENGTH } from "@auction/shop-contracts";
import { Field, Notice, StaffButton, StaffDialog, TextInput, toast } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

export type SwapTarget = { editionId: string; label: string } | null;

/**
 * Packing: scan the stock label, or type what is written on the print, and it is checked against
 * the print the order was sold. A match is confirmed. Anything else changes nothing; the dialog
 * says what the print in hand is and offers the next step: look for the right print again, send
 * the print in hand instead, or send the next free print.
 */
export function ConfirmPrintDialog({
  row,
  open,
  onOpenChange,
  canSwapAcrossOwners,
  onSwap,
}: {
  row: PackRowView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canSwapAcrossOwners: boolean;
  /** Opens the swap dialog for the print in hand, or the next free print when null. */
  onSwap: (target: SwapTarget) => void;
}) {
  const router = useRouter();
  const formId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ConfirmNotice | null>(null);
  const [emptyError, setEmptyError] = useState(false);

  const submit = async () => {
    if (!value.trim()) {
      setEmptyError(true);
      return;
    }
    setEmptyError(false);
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await confirmPrint({
      orderLineId: row.orderLineId,
      body: { source: scanSource(value), value: value.trim() },
      idempotencyKey: crypto.randomUUID(),
    }).catch(() => ({ ok: false, kind: "failed", message: "Action failed. Try again." }) as const);
    setPending(false);
    if (!result.ok) {
      setError(adminMutationErrorMessage(result));
      return;
    }
    if (result.data.outcome === "confirmed") {
      toast.success(`${result.data.label} confirmed`);
      setValue("");
      onOpenChange(false);
      router.refresh();
      return;
    }
    setNotice(confirmNotice(result.data, row.label, canSwapAcrossOwners));
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      initialFocusRef={inputRef}
      title={`Confirm ${row.title}`}
      description={`The order is for ${row.label}. Check the print before it is packed.`}
      footer={
        <>
          <StaffButton variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" type="submit" form={formId} loading={pending}>
            Confirm print
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error ? <Notice tone="danger" alert title={error} /> : null}
        {notice ? (
          <Notice tone="warning" alert title={notice.title}>
            <p>{notice.body}</p>
            <PrintNextSteps
              notice={notice}
              orderedLabel={row.label}
              onSwap={(target) => {
                onOpenChange(false);
                onSwap(target);
              }}
              onTryAgain={() => inputRef.current?.focus()}
            />
          </Notice>
        ) : null}
        <Field
          id={`${formId}-scan`}
          label={CONFIRM_FIELD_LABEL}
          description={CONFIRM_FIELD_HELP}
          error={emptyError ? CONFIRM_FIELD_EMPTY : undefined}
        >
          <TextInput
            ref={inputRef}
            value={value}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="characters"
            maxLength={PRINT_SCAN_MAX_LENGTH}
            placeholder={row.label}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}

function PrintNextSteps({
  notice,
  orderedLabel,
  onSwap,
  onTryAgain,
}: {
  notice: ConfirmNotice;
  orderedLabel: string;
  onSwap: (target: SwapTarget) => void;
  onTryAgain: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col items-start gap-2">
      <StaffButton size="sm" variant="secondary" onClick={onTryAgain}>
        {`Pull ${orderedLabel} instead`}
      </StaffButton>
      {notice.kind === "swap" ? (
        <>
          <StaffButton
            size="sm"
            variant="secondary"
            disabled={notice.blockedReason !== null}
            onClick={() => onSwap(notice.target)}
          >
            {`Send ${notice.target.label} instead`}
          </StaffButton>
          {notice.blockedReason ? <p className="text-staff-xs">{notice.blockedReason}</p> : null}
        </>
      ) : null}
      <StaffButton size="sm" variant="secondary" onClick={() => onSwap(null)}>
        {`${orderedLabel} is missing or damaged`}
      </StaffButton>
    </div>
  );
}
