"use client";

import { ClockIcon } from "lucide-react";

import { cn } from "../../lib/utils.js";
import { Input } from "./input.js";

export type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/** Styled native `type="time"` wrapper (`HH:mm`) — native input is encapsulated here only. */
function TimePicker({
  value,
  onChange,
  onBlur,
  disabled,
  id,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: TimePickerProps) {
  return (
    <div className={cn("relative", className)}>
      <ClockIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-on-surface-variant" />
      <Input
        id={id}
        type="time"
        step={60}
        value={value}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 pl-9 font-body text-sm disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-calendar-picker-indicator]:opacity-0"
      />
    </div>
  );
}

export { TimePicker };
