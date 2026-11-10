"use client";

import { TimesZoneNote } from "@/components/admin/forms/times-zone-note";
import { DateTimeInput, Field } from "@auction/staff-ui";
import { toDatetimeFormString } from "@auction/ui/lib/datetime";

/** The wall-clock string the sale-setup validators take, from the kit's ISO instant in `zone`. */
export function isoToFormString(iso: string | null, zone: string): string {
  return iso ? toDatetimeFormString(new Date(iso), zone) : "";
}

type Props = {
  start: string | null;
  end: string | null;
  onStartChange: (iso: string | null) => void;
  onEndChange: (iso: string | null) => void;
  startError?: string | undefined;
  endError?: string | undefined;
  disabled?: boolean;
  /** The sale's zone: the two moments are typed and shown in it. */
  timeZone: string;
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
  timeZone,
  idPrefix,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <TimesZoneNote zone={timeZone} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Lot opens"
          error={startError}
          disabled={disabled}
          {...(idPrefix ? { id: `${idPrefix}-startTime` } : {})}
        >
          <DateTimeInput
            value={start}
            onValueChange={onStartChange}
            timeLabel="Lot opening time"
            timeZone={timeZone}
            showZone={false}
          />
        </Field>
        <Field
          label="Lot closes"
          error={endError}
          disabled={disabled}
          {...(idPrefix ? { id: `${idPrefix}-endTime` } : {})}
        >
          <DateTimeInput
            value={end}
            onValueChange={onEndChange}
            timeLabel="Lot closing time"
            timeZone={timeZone}
            showZone={false}
          />
        </Field>
      </div>
    </div>
  );
}
