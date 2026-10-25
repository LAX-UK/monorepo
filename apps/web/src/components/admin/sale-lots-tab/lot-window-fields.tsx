"use client";

import { DateTimeInput, Field } from "@auction/staff-ui";
import { toDatetimeFormString } from "@auction/ui/lib/datetime";

/** The wall-clock string the sale-setup validators take, from the kit's ISO instant. */
export function isoToFormString(iso: string | null): string {
  return iso ? toDatetimeFormString(new Date(iso)) : "";
}

type Props = {
  start: string | null;
  end: string | null;
  onStartChange: (iso: string | null) => void;
  onEndChange: (iso: string | null) => void;
  startError?: string | undefined;
  endError?: string | undefined;
  disabled?: boolean;
  /** Prefix for the two fields' ids, so an error summary can link to them. */
  idPrefix?: string;
};

/** A lot's opening and closing moments, side by side where there is room. */
export function LotWindowFields({
  start,
  end,
  onStartChange,
  onEndChange,
  startError,
  endError,
  disabled = false,
  idPrefix,
}: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Lot opens"
        error={startError}
        disabled={disabled}
        {...(idPrefix ? { id: `${idPrefix}-startTime` } : {})}
      >
        <DateTimeInput value={start} onValueChange={onStartChange} timeLabel="Lot opening time" />
      </Field>
      <Field
        label="Lot closes"
        error={endError}
        disabled={disabled}
        {...(idPrefix ? { id: `${idPrefix}-endTime` } : {})}
      >
        <DateTimeInput value={end} onValueChange={onEndChange} timeLabel="Lot closing time" />
      </Field>
    </div>
  );
}
