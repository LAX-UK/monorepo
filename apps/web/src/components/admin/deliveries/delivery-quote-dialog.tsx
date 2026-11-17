"use client";

import type {
  SendDeliveryQuoteInput,
  SendQuoteRefusal,
  sendDeliveryQuoteAction,
} from "@/lib/actions/admin/admin-deliveries";
import { DELIVERIES_COPY } from "@/lib/admin/deliveries/deliveries-copy";
import { deliveryBuyerLine, deliveryLotTitle } from "@/lib/admin/deliveries/deliveries.vm";
import {
  QUOTE_NOTE_MAX_LENGTH,
  type QuoteAction,
  type QuoteFormField,
  type QuoteFormValues,
  checkQuoteForm,
  quoteExpectation,
  quoteFormValues,
} from "@/lib/admin/deliveries/delivery-quote-form";
import { redirectToHostedReauth } from "@/lib/auth/step-up/use-step-up-coordinator";
import type { DeliveryView } from "@/lib/data/http/admin-deliveries.schema";
import type { ActionResult } from "@/lib/forms/form-result";
import {
  Field,
  FormErrorSummary,
  MoneyInput,
  Notice,
  StaffButton,
  StaffDialog,
  TextArea,
  formatStaffMoney,
  useStaffStepUp,
} from "@auction/staff-ui";
import { Send } from "@auction/staff-ui/icons";
import { useId, useRef, useState } from "react";

const COPY = DELIVERIES_COPY.quote;

/** Where the dialog is: the form, the confirmation, or a refusal that ends this attempt. */
type Step =
  | { kind: "form" }
  | { kind: "confirm"; pence: number }
  | { kind: "stale" }
  | { kind: "already_quoted"; amountMinor: number | null }
  | { kind: "denied" };

export type QuoteDialogOutcome =
  | { kind: "sent" }
  /** The delivery moved on (someone else priced it, or the buyer acted): the panel reads again. */
  | { kind: "moved"; by: "staff" | "buyer" };

type Props = {
  row: DeliveryView;
  action: QuoteAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The server action; injectable so the dialog is tested on its own. */
  send: typeof sendDeliveryQuoteAction;
  /** Told when a send ends, before the dialog closes (sent) or while it explains (moved). */
  onOutcome: (outcome: QuoteDialogOutcome) => void;
};

/**
 * Send quote and Change quote (D5): the price (`MoneyInput`, whole pence) and an optional note to
 * the buyer, then a confirmation that says who is emailed and what changes, since this is money
 * to a customer. Nothing is shown as sent until the server says so (no optimistic state).
 *
 * Errors follow the forms rule: two fields failing show the summary as well as each field's
 * message; one failing shows its message and takes focus (the price, as the route words it).
 * Failures stay in the dialog (FBK-1), and a delivery that moved on while it was open says so
 * and offers the way back to the panel, which reads it again (D6).
 */
export function DeliveryQuoteDialog(props: Props) {
  // A fresh attempt (fields, step and Idempotency-Key) each time the dialog opens; the same one
  // while it closes, so it closes in place and hands focus back to what opened it.
  const [session, setSession] = useState({ count: 0, open: props.open });
  if (props.open !== session.open) {
    setSession({ count: props.open ? session.count + 1 : session.count, open: props.open });
  }
  return <QuoteDialogSession key={session.count} {...props} />;
}

function QuoteDialogSession({ row, action, open, onOpenChange, send, onOutcome }: Props) {
  const ids = useId();
  const formId = `${ids}-form`;
  const fieldIds: Record<QuoteFormField, string> = {
    price: `${ids}-price`,
    note: `${ids}-note`,
  };
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [expected] = useState(() => quoteExpectation(row));
  const [values, setValues] = useState<QuoteFormValues>(() => quoteFormValues(row));
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const lot = deliveryLotTitle(row.lot);
  const buyer = deliveryBuyerLine(row.buyer);
  const verb = action === "send" ? COPY.send : COPY.change;
  const errors = attempts > 0 ? checkQuoteForm(values) : {};
  const failed = (Object.keys(errors) as QuoteFormField[]).filter((field) => errors[field]);
  const label: Record<QuoteFormField, string> = { price: COPY.price, note: COPY.note };
  // The summary only when two fields fail; one failure is said at its field, which takes focus.
  const summary =
    failed.length > 1
      ? failed.map((field) => ({
          fieldId: fieldIds[field],
          message: COPY.summaryLine(label[field], errors[field] as string),
        }))
      : [];

  function continueToConfirm() {
    const found = checkQuoteForm(values);
    const fields = (Object.keys(found) as QuoteFormField[]).filter((field) => found[field]);
    setAttempts((count) => count + 1);
    if (fields.length === 1) {
      const only = fields[0] as QuoteFormField;
      requestAnimationFrame(() => document.getElementById(fieldIds[only])?.focus());
    }
    if (fields.length > 0 || values.pence === null) return;
    setFailure(null);
    setStep({ kind: "confirm", pence: values.pence });
  }

  async function sendQuote(pence: number) {
    if (!expected || busy) return;
    setBusy(true);
    setFailure(null);
    const input: SendDeliveryQuoteInput = {
      lotId: row.lotId,
      pence,
      note: values.note,
      expected,
      idempotencyKey,
    };
    let result: ActionResult<{ lotId: string }>;
    try {
      result = await send(input);
    } catch {
      result = { ok: false, error: COPY.failed.unavailable, errorCode: "unavailable" };
    }
    setBusy(false);
    if (result.ok) {
      onOutcome({ kind: "sent" });
      onOpenChange(false);
      return;
    }
    if (stepUp.handle(result, COPY.stepUp(formatStaffMoney(pence, "GBP")))) return;
    const code = result.errorCode as SendQuoteRefusal | undefined;
    if (code === "quote_changed") {
      setStep({ kind: "stale" });
      onOutcome({ kind: "moved", by: "buyer" });
    } else if (code === "already_quoted") {
      const amount = result.meta?.amountMinor;
      setStep({ kind: "already_quoted", amountMinor: typeof amount === "number" ? amount : null });
      onOutcome({ kind: "moved", by: "staff" });
    } else if (code === "forbidden") {
      setStep({ kind: "denied" });
    } else {
      setFailure(result.error || COPY.failed.unavailable);
      submitRef.current?.focus();
    }
  }

  const ended = step.kind === "stale" || step.kind === "already_quoted" || step.kind === "denied";
  const confirming = step.kind === "confirm";
  const title = confirming ? COPY.confirmTitle[action] : COPY.title(verb, lot);

  const footer = ended ? (
    <StaffButton variant="primary" onClick={() => onOpenChange(false)}>
      {COPY.backToDelivery}
    </StaffButton>
  ) : confirming ? (
    <>
      <StaffButton
        variant="secondary"
        disabled={busy}
        onClick={() => {
          setFailure(null);
          setStep({ kind: "form" });
        }}
      >
        {COPY.back}
      </StaffButton>
      <StaffButton
        ref={submitRef}
        variant="primary"
        loading={busy}
        icon={<Send aria-hidden />}
        onClick={() => void sendQuote(step.pence)}
      >
        {COPY.submit[action]}
      </StaffButton>
    </>
  ) : (
    <>
      <StaffButton variant="secondary" onClick={() => onOpenChange(false)}>
        {COPY.cancel}
      </StaffButton>
      <StaffButton type="submit" form={formId} variant="primary">
        {COPY.continue}
      </StaffButton>
    </>
  );

  return (
    <>
      <StaffDialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) onOpenChange(next);
        }}
        size="md"
        title={title}
        description={confirming || ended ? undefined : COPY.description(buyer, row.destination)}
        footer={footer}
      >
        {step.kind === "stale" ? (
          <Notice tone="warning" alert title={COPY.stale.title}>
            {COPY.stale.description}
          </Notice>
        ) : step.kind === "already_quoted" ? (
          <Notice tone="warning" alert title={COPY.alreadyQuoted.title}>
            {COPY.alreadyQuoted.description(
              step.amountMinor === null ? null : formatStaffMoney(step.amountMinor, "GBP"),
            )}
          </Notice>
        ) : step.kind === "denied" ? (
          <Notice tone="danger" alert title={COPY.denied.title}>
            {COPY.denied.description}
          </Notice>
        ) : step.kind === "confirm" ? (
          <div className="flex flex-col gap-4" aria-busy={busy || undefined}>
            {failure ? (
              <Notice tone="danger" alert title={COPY.failed.title}>
                {failure}
              </Notice>
            ) : null}
            <p className="text-staff-sm text-staff-fg">
              {COPY.confirm[action](formatStaffMoney(step.pence, "GBP"), buyer)}
            </p>
            {values.note.trim() ? (
              <div className="flex flex-col gap-1">
                <p className="text-staff-xs font-medium text-staff-muted">{COPY.confirmNote}</p>
                <p className="whitespace-pre-line break-words text-staff-sm text-staff-fg">
                  {values.note.trim()}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <form
            id={formId}
            noValidate
            aria-label={COPY.title(verb, lot)}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              continueToConfirm();
            }}
          >
            <FormErrorSummary errors={summary} focusKey={attempts} />
            <Field
              id={fieldIds.price}
              label={COPY.price}
              description={COPY.priceHint}
              error={errors.price}
            >
              <MoneyInput
                value={values.pence}
                onValueChange={(pence, parsed) =>
                  setValues((current) => ({
                    ...current,
                    pence,
                    parse: parsed.ok ? null : parsed.reason,
                  }))
                }
              />
            </Field>
            <Field
              id={fieldIds.note}
              label={COPY.note}
              description={COPY.noteHint}
              optional
              error={errors.note}
            >
              <TextArea
                rows={3}
                maxLength={QUOTE_NOTE_MAX_LENGTH}
                value={values.note}
                onChange={(event) =>
                  setValues((current) => ({ ...current, note: event.target.value }))
                }
              />
            </Field>
            {action === "change" && row.quote.amountMinor !== null ? (
              <p className="text-staff-sm text-staff-muted">
                {COPY.current(formatStaffMoney(row.quote.amountMinor, row.quote.currency))}
              </p>
            ) : null}
          </form>
        )}
      </StaffDialog>
      {stepUp.dialog}
    </>
  );
}
