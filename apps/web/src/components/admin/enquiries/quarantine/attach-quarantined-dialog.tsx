"use client";

import { QUARANTINE_COPY } from "@/lib/admin/enquiries/enquiry-email-copy";
import { attachTarget } from "@/lib/admin/enquiries/quarantine.vm";
import {
  ChoiceFieldset,
  ChoiceRow,
  ConfirmActionDialog,
  Field,
  Notice,
  StaffRadio,
  StaffRadioGroup,
  TextInput,
} from "@auction/staff-ui";
import { useEffect, useId, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The enquiry the email's reply address named, when it named one the person may open. */
  suspectReference: string | null;
  busy: boolean;
  failure: string | null;
  onAttach: (reference: string) => void;
};

/**
 * Confirms attaching a held email to exactly one enquiry: the suspected one, or one the person
 * names by reference. The button names the enquiry it will go to.
 */
export function AttachQuarantinedDialog({
  open,
  onOpenChange,
  suspectReference,
  busy,
  failure,
  onAttach,
}: Props) {
  const name = useId();
  const [choice, setChoice] = useState<"suspect" | "other">(suspectReference ? "suspect" : "other");
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChoice(suspectReference ? "suspect" : "other");
    setTyped("");
    setTouched(false);
  }, [open, suspectReference]);

  const target = attachTarget(choice, suspectReference, typed);
  const copy = QUARANTINE_COPY.attach;
  const showInvalid = choice === "other" && touched && !target;

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
      confirmDisabled={!target}
      onConfirm={() => {
        setTouched(true);
        if (target) onAttach(target);
      }}
    >
      {failure ? (
        <Notice tone="danger" alert title="That did not go through">
          {failure}
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
    </ConfirmActionDialog>
  );
}
