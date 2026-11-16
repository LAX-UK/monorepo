"use client";

import { QUARANTINE_COPY } from "@/lib/admin/enquiries/enquiry-email-copy";
import {
  attachTarget,
  reviewReasonError,
  reviewReasonOf,
} from "@/lib/admin/enquiries/quarantine.vm";
import {
  ChoiceFieldset,
  ChoiceRow,
  ConfirmActionDialog,
  Field,
  Notice,
  StaffCheckbox,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
  TextInput,
} from "@auction/staff-ui";
import { useEffect, useId, useState } from "react";
import type { QuarantineAttachInput } from "./use-quarantine-review";

/** Why the email was held, when that alone means its sender is not verified. */
export type UnverifiedSender = { label: string; description: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The enquiry the email's reply address named, when it named one the person may open. */
  suspectReference: string | null;
  /** Set when the held email's own facts say its sender is not verified. */
  unverified: UnverifiedSender | null;
  /** The API asked for the confirmation (the sender is not the chosen enquiry's client). */
  confirmationRequested: boolean;
  busy: boolean;
  failure: string | null;
  onAttach: (input: QuarantineAttachInput) => void;
};

/**
 * Confirms attaching a held email to exactly one enquiry: the suspected one, or one the person
 * names by reference, with a reason kept in the audit trail. When the sender is not verified, the
 * dialog says why it was held and asks for an explicit confirmation before it attaches.
 */
export function AttachQuarantinedDialog({
  open,
  onOpenChange,
  suspectReference,
  unverified,
  confirmationRequested,
  busy,
  failure,
  onAttach,
}: Props) {
  const name = useId();
  const [choice, setChoice] = useState<"suspect" | "other">(suspectReference ? "suspect" : "other");
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChoice(suspectReference ? "suspect" : "other");
    setTyped("");
    setTouched(false);
    setReason("");
    setReasonTouched(false);
    setConfirmed(false);
  }, [open, suspectReference]);

  const target = attachTarget(choice, suspectReference, typed);
  const givenReason = reviewReasonOf(reason);
  const copy = QUARANTINE_COPY.attach;
  const showInvalid = choice === "other" && touched && !target;
  const asksConfirmation = Boolean(unverified) || confirmationRequested;
  const ready = Boolean(target && givenReason && (!asksConfirmation || confirmed));

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title={copy.title}
      description={copy.description}
      confirmLabel={target ? copy.confirm(target) : copy.confirmEmpty}
      cancelLabel={copy.cancel}
      loading={busy}
      confirmDisabled={!ready}
      onConfirm={() => {
        setTouched(true);
        setReasonTouched(true);
        if (target && givenReason && (!asksConfirmation || confirmed)) {
          onAttach({
            enquiryReference: target,
            reason: givenReason,
            confirmSenderNotVerified: asksConfirmation && confirmed,
          });
        }
      }}
    >
      {failure ? (
        <Notice tone="danger" alert title={QUARANTINE_COPY.failureTitle}>
          {failure}
        </Notice>
      ) : null}
      {asksConfirmation ? (
        <Notice tone="warning" title={copy.unverifiedTitle}>
          {unverified
            ? copy.unverifiedBody(unverified.label, unverified.description)
            : copy.unverifiedOtherAddress}
        </Notice>
      ) : null}
      {suspectReference ? (
        <ChoiceFieldset legend={copy.choiceLegend} disabled={busy}>
          <StaffRadioGroup
            name={name}
            value={choice}
            onValueChange={(value) => setChoice(value === "other" ? "other" : "suspect")}
          >
            <ChoiceRow
              htmlFor={`${name}-suspect`}
              label={copy.suspectLabel(suspectReference)}
              disabled={busy}
              control={<StaffRadio id={`${name}-suspect`} value="suspect" disabled={busy} />}
            />
            <ChoiceRow
              htmlFor={`${name}-other`}
              label={copy.otherLabel}
              disabled={busy}
              control={<StaffRadio id={`${name}-other`} value="other" disabled={busy} />}
            />
          </StaffRadioGroup>
        </ChoiceFieldset>
      ) : null}
      {choice === "other" ? (
        <Field
          label={copy.referenceLabel}
          description={copy.otherHint}
          error={showInvalid ? copy.referenceInvalid : null}
        >
          <TextInput
            value={typed}
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            placeholder="E-1042"
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={() => setTouched(true)}
          />
        </Field>
      ) : null}
      <Field
        label={copy.reasonLabel}
        description={copy.reasonHint}
        error={reasonTouched ? reviewReasonError(reason) : null}
        disabled={busy}
      >
        <TextArea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setReasonTouched(true)}
        />
      </Field>
      {asksConfirmation ? (
        <ChoiceRow
          htmlFor={`${name}-confirm`}
          label={copy.confirmUnverified}
          disabled={busy}
          control={
            <StaffCheckbox
              id={`${name}-confirm`}
              checked={confirmed}
              disabled={busy}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
          }
        />
      ) : null}
    </ConfirmActionDialog>
  );
}
