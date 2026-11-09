"use client";

import { dealMoveAction } from "@/lib/actions/admin/admin-private-sales";
import { isStaleDeal } from "@/lib/admin/private-sales/private-sale-errors";
import { DEAL_ACTION_COPY } from "@/lib/admin/private-sales/private-sales.vm";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import type { DealBlocker, DealRecord } from "@/lib/data/http/admin-private-sales.schema";
import type { ActionResult } from "@/lib/forms/form-result";
import { Field, MoneyInput, Notice, StaffButton, StaffDialog, TextArea } from "@auction/staff-ui";
import type { StaffDealAction } from "@auction/validators";
import { useEffect, useId, useRef, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealRecord;
  action: StaffDealAction;
  onReload: () => void;
  onDone: (action: StaffDealAction, deal: DealRecord) => void;
  /** The move, injectable so the dialog can be tested on its own. */
  move?: typeof dealMoveAction;
};

type Failure = { message: string; stale: boolean; blockers: DealBlocker[] };

function failureOf(result: Extract<ActionResult<DealRecord>, { ok: false }>): Failure {
  const blockers = result.meta?.blockers;
  return {
    message: result.error,
    stale: isStaleDeal(result.errorCode),
    blockers: Array.isArray(blockers) ? (blockers as DealBlocker[]) : [],
  };
}

/**
 * Confirms one move on a deal. The effect is stated first, in the present tense, so nobody
 * clicks through a move without knowing what it does. A move that asks for a reason keeps it with
 * the deal; a move that takes or returns money carries one idempotency key for the whole time the
 * dialog is open, so a double click repeats one request.
 */
export function DealActionDialog({
  open,
  onOpenChange,
  deal,
  action,
  onReload,
  onDone,
  move = dealMoveAction,
}: Props) {
  const copy = DEAL_ACTION_COPY[action];
  const ids = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const key = useRef(crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  useEffect(() => {
    if (!open) return;
    key.current = crypto.randomUUID();
    setReason("");
    setAmountMinor(null);
    setAttempted(false);
    setFailure(null);
  }, [open]);

  const reasonMissing = copy.reason?.required === true && reason.trim() === "";
  const reasonError = attempted && reasonMissing ? copy.reason?.missing : undefined;
  const amount = "amount" in copy ? copy.amount : undefined;
  const amountMissing = amount?.required === true && (amountMinor === null || amountMinor <= 0);
  const amountError = attempted && amountMissing ? amount?.missing : undefined;

  async function proceed() {
    setAttempted(true);
    if (reasonMissing || amountMissing) return;
    setFailure(null);
    setBusy(true);
    const result = await move(deal.reference, action, {
      version: deal.version,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      ...(amountMinor !== null && amountMinor > 0 ? { amountMinor } : {}),
      idempotencyKey: key.current,
    });
    setBusy(false);
    if (result.ok && result.data) {
      onOpenChange(false);
      onDone(action, result.data);
      return;
    }
    if (result.ok) return;
    if (handleStaffStepUp(result)) return;
    setFailure(failureOf(result));
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="md"
      initialFocusRef={cancelRef}
      title={`${copy.label} · ${deal.reference}`}
      description={copy.effect(deal)}
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Not now
          </StaffButton>
          <StaffButton
            type="submit"
            form={`${ids}-form`}
            variant={
              action === "cancel" || action === "refund" || action === "record_bank_refund"
                ? "danger"
                : "primary"
            }
            loading={busy}
          >
            {copy.confirm}
          </StaffButton>
        </>
      }
    >
      <form
        id={`${ids}-form`}
        noValidate
        aria-label={copy.label}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void proceed();
        }}
      >
        {failure ? (
          <FailureNotice
            failure={failure}
            title={`${copy.label} didn't go through`}
            onReload={onReload}
          />
        ) : null}
        {amount ? (
          <Field
            label={amount.label}
            id={`${ids}-amount`}
            description={amount.hint}
            error={amountError}
            optional={!amount.required}
            disabled={busy}
          >
            <MoneyInput value={amountMinor} onValueChange={setAmountMinor} />
          </Field>
        ) : null}
        {copy.reason ? (
          <Field
            label={copy.reason.label}
            id={`${ids}-reason`}
            description={copy.reason.hint}
            error={reasonError}
            disabled={busy}
          >
            <TextArea
              rows={3}
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        ) : null}
        {copy.money ? (
          <p className="m-0 text-staff-sm text-staff-muted">
            This moves money, so you may be asked to sign in again first.
          </p>
        ) : null}
      </form>
    </StaffDialog>
  );
}

/** A move that did not go through, shown where it was made, with every reason it is blocked. */
export function FailureNotice({
  failure,
  title,
  onReload,
}: {
  failure: Failure;
  title: string;
  onReload: () => void;
}) {
  if (failure.stale) {
    return (
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
        Someone else changed this deal while you had it open. Reload to see their changes; nothing
        was changed.
      </Notice>
    );
  }
  return (
    <Notice tone="danger" alert title={title}>
      {failure.blockers.length > 0 ? (
        <ul className="m-0 list-disc pl-5">
          {failure.blockers.map((blocker) => (
            <li key={`${blocker.code}-${blocker.party ?? ""}`}>{blocker.message}</li>
          ))}
        </ul>
      ) : (
        failure.message
      )}
    </Notice>
  );
}

export type { Failure as DealWriteFailure };
export { failureOf as dealFailureOf };
