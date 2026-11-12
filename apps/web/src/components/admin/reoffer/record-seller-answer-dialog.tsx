"use client";

import { SELLER_PREFERENCE_LABEL } from "@/lib/admin/reoffer/reoffer-status";
import {
  ChoiceFieldset,
  ChoiceRow,
  ConfirmActionDialog,
  EnumSelect,
  Field,
  Notice,
  StaffRadio,
  StaffRadioGroup,
  formatStaffMoney,
} from "@auction/staff-ui";
import type { RecordSellerAnswerBody, StaffReoffer } from "@auction/validators";
import { useId, useState } from "react";

const CHANNELS = [
  { value: "Phone", label: "Phone" },
  { value: "Email", label: "Email" },
  { value: "In person", label: "In person" },
] as const;
type Channel = (typeof CHANNELS)[number]["value"];

const PREFERENCES = Object.entries(SELLER_PREFERENCE_LABEL).map(([value, label]) => ({
  value,
  label: label.charAt(0).toUpperCase() + label.slice(1),
}));

type Props = {
  open: boolean;
  offer: StaffReoffer;
  busy: boolean;
  failure: string | null;
  onSubmit: (body: RecordSellerAnswerBody) => void;
  onOpenChange: (open: boolean) => void;
};

/** What the seller told staff, recorded for them with the note that is kept as the evidence. */
export function RecordSellerAnswerDialog({
  open,
  offer,
  busy,
  failure,
  onSubmit,
  onOpenChange,
}: Props) {
  const radioName = useId();
  const [answer, setAnswer] = useState<"given" | "refused">("given");
  const [channel, setChannel] = useState<Channel>("Phone");
  const [preference, setPreference] = useState<string | null>(null);

  const submit = ({ reason }: { reason: string }) => {
    // How they told us is kept at the front of the note, which is the record of the answer.
    const note = `${channel}: ${reason}`;
    onSubmit(
      answer === "given"
        ? { answer, note }
        : {
            answer,
            note,
            ...(preference
              ? { declinePreference: preference as "later_sale" | "return_to_me" | "talk_to_us" }
              : {}),
          },
    );
  };

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record the seller's answer"
      description="Use this for an answer the seller gave by phone, email or in person. Their own answer in the workspace is recorded as it comes."
      confirmLabel="Record answer"
      loading={busy}
      onConfirm={submit}
      reason={{
        label: "Note",
        description: "Who you spoke to and when. Kept as the record of their answer.",
        maxLength: 900,
        missingMessage: "Enter a note",
      }}
    >
      {failure ? (
        <Notice tone="danger" alert title="That did not go through">
          {failure}
        </Notice>
      ) : null}
      <div className="rounded-staff-md border border-staff-line-subtle bg-staff-sunken px-3 py-2 text-staff-xs text-staff-muted">
        <p className="text-staff-sm font-medium text-staff-fg">
          Offer to the next bidder at {formatStaffMoney(offer.offerMinor)}
        </p>
        <p>
          Original sale {formatStaffMoney(offer.originalHammerMinor)} · estimated proceeds{" "}
          {formatStaffMoney(offer.estimatedProceedsMinor)} ·{" "}
          {offer.reserveMinor === null
            ? "no reserve"
            : offer.belowReserve
              ? `below the reserve of ${formatStaffMoney(offer.reserveMinor)}`
              : `reserve ${formatStaffMoney(offer.reserveMinor)}`}
        </p>
      </div>
      <ChoiceFieldset legend="Their answer" disabled={busy}>
        <StaffRadioGroup
          name={radioName}
          value={answer}
          onValueChange={(value) => setAnswer(value === "refused" ? "refused" : "given")}
        >
          {(
            [
              ["given", "They agree"],
              ["refused", "They don't agree"],
            ] as const
          ).map(([value, label]) => (
            <ChoiceRow
              key={value}
              htmlFor={`${radioName}-${value}`}
              label={label}
              disabled={busy}
              control={<StaffRadio id={`${radioName}-${value}`} value={value} disabled={busy} />}
            />
          ))}
        </StaffRadioGroup>
      </ChoiceFieldset>
      <Field label="How they told us">
        <EnumSelect<Channel>
          value={channel}
          onValueChange={setChannel}
          options={CHANNELS}
          disabled={busy}
        />
      </Field>
      {answer === "refused" ? (
        <Field label="What they'd like instead" optional>
          <EnumSelect
            value={preference}
            onValueChange={setPreference}
            options={PREFERENCES}
            placeholder="Not said"
            disabled={busy}
          />
        </Field>
      ) : null}
    </ConfirmActionDialog>
  );
}
