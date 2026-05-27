"use client";

import { CalendarIcon } from "lucide-react";
import * as React from "react";
import {
  AUCTION_ZONE_LABEL,
  DEFAULT_AUCTION_ZONE,
  combineDateAndTime,
  formatDatetimeDisplayHuman,
  fromDatetimeFormString,
  toCalendarDate,
  toDateFormString,
  toDatetimeFormString,
  toTimeFormString,
  zonedInstantToDatetimeFormString,
} from "../../lib/datetime/index.js";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import { Calendar } from "./calendar.js";
import { ResponsivePickerShell } from "./responsive-picker-shell.js";
import { TimePicker } from "./time-picker.js";

export type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
  zone?: string;
  showZoneLabel?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

function DateTimePickerPanel({
  timePart,
  selected,
  zone,
  disabled = false,
  showZoneLabel,
  onDateSelect,
  onTimeChange,
}: {
  timePart: string;
  selected: Date | undefined;
  zone: string;
  disabled?: boolean;
  showZoneLabel: boolean;
  onDateSelect: (day: Date) => void;
  onTimeChange: (time: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <Calendar
        mode="single"
        timeZone={zone}
        selected={selected}
        onSelect={(day) => {
          if (!day) return;
          onDateSelect(day);
        }}
        initialFocus
      />
      <div className="grid gap-1 border-t border-outline-variant/25 pt-3">
        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          Time
        </span>
        <TimePicker value={timePart} disabled={disabled ?? false} onChange={onTimeChange} />
      </div>
      {showZoneLabel ? (
        <p className="font-body text-xs text-on-surface-variant">{AUCTION_ZONE_LABEL}</p>
      ) : null}
    </div>
  );
}

function DateTimePicker({
  value,
  onChange,
  onBlur,
  disabled,
  id,
  className,
  placeholder = "Pick date and time",
  zone = DEFAULT_AUCTION_ZONE,
  showZoneLabel = true,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = value.trim() ? fromDatetimeFormString(value, zone) : null;
  const datePart = parsed ? toDateFormString(parsed.instant, zone) : "";
  const timePart = parsed ? toTimeFormString(parsed.instant, zone) : "12:00";
  const selected = parsed ? toCalendarDate(parsed.instant, zone) : undefined;

  const apply = (nextDate: string, nextTime: string) => {
    const zoned = combineDateAndTime(nextDate, nextTime, zone);
    onChange(zonedInstantToDatetimeFormString(zoned));
  };

  const displayLabel = value.trim() ? formatDatetimeDisplayHuman(value, zone) : placeholder;

  const panelProps = {
    timePart,
    selected,
    zone,
    disabled: disabled ?? false,
    showZoneLabel,
    onDateSelect: (day: Date) => apply(toDateFormString(day, zone), timePart),
    onTimeChange: (t: string) => {
      const d = datePart || toDateFormString(new Date(), zone);
      apply(d, t);
    },
  };

  const doneButton = (
    <Button type="button" className="min-h-11 w-full" onClick={() => setOpen(false)}>
      Done
    </Button>
  );

  const trigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      disabled={disabled}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      onBlur={onBlur}
      className={cn(
        "min-h-11 w-full justify-start px-3 py-3 text-left font-body text-sm font-normal",
        !value && "text-on-surface-variant",
      )}
    >
      <CalendarIcon className="mr-2 size-4 opacity-60" />
      {displayLabel}
    </Button>
  );

  return (
    <div className={cn("grid gap-1", className)}>
      <ResponsivePickerShell
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        panel={<DateTimePickerPanel {...panelProps} />}
        footer={doneButton}
        sheetTitle="Pick date and time"
      />
      {showZoneLabel && !open ? (
        <p className="font-body text-xs text-on-surface-variant">{AUCTION_ZONE_LABEL}</p>
      ) : null}
    </div>
  );
}

export { DateTimePicker, toDatetimeFormString };
