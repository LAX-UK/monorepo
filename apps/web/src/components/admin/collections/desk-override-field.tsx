"use client";

import { ChoiceRow, Field, StaffCheckbox, TextArea } from "@auction/staff-ui";

/**
 * Staff may book a time that is full or too soon for a client they have spoken to. The tick says
 * so and a reason is then required; it is kept with their name and never shown to the client. A
 * time the rules already refuse keeps the tick on, because it cannot be booked without it.
 */
export function DeskOverrideField({
  id,
  checked,
  required,
  onCheckedChange,
  reason,
  onReasonChange,
  error,
}: {
  id: string;
  checked: boolean;
  /** The chosen time needs the override: it is ticked and cannot be cleared. */
  required: boolean;
  onCheckedChange: (checked: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  error?: string | undefined;
}) {
  const on = checked || required;
  return (
    <div className="flex flex-col gap-3">
      <ChoiceRow
        htmlFor={`${id}-override`}
        control={
          <StaffCheckbox
            id={`${id}-override`}
            checked={on}
            disabled={required}
            onCheckedChange={(next) => onCheckedChange(next === true)}
          />
        }
        label="Book even if the time is full or too soon"
        description="For a client you've spoken to. Recorded with your name."
      />
      {on ? (
        <Field id={id} label="Reason" error={error}>
          <TextArea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={3}
          />
        </Field>
      ) : null}
    </div>
  );
}
