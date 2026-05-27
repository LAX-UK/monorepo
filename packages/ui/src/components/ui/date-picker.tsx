"use client";

import { CalendarIcon } from "lucide-react";
import * as React from "react";

import {
  DEFAULT_AUCTION_ZONE,
  fromDateFormString,
  toCalendarDate,
  toDateFormString,
} from "../../lib/datetime/index.js";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import { Calendar } from "./calendar.js";
import { ResponsivePickerShell } from "./responsive-picker-shell.js";

export type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
  zone?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

function DatePicker({
  value,
  onChange,
  onBlur,
  disabled,
  id,
  className,
  placeholder = "Pick a date",
  zone = DEFAULT_AUCTION_ZONE,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value
    ? toCalendarDate(fromDateFormString(value, zone).instant, zone)
    : undefined;

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
        className,
      )}
    >
      <CalendarIcon className="mr-2 size-4 opacity-60" />
      {value || placeholder}
    </Button>
  );

  return (
    <ResponsivePickerShell
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      sheetTitle="Pick a date"
      panel={
        <Calendar
          mode="single"
          timeZone={zone}
          selected={selected}
          onSelect={(day) => {
            if (!day) return;
            onChange(toDateFormString(day, zone));
            setOpen(false);
          }}
          initialFocus
        />
      }
    />
  );
}

export { DatePicker };
