"use client";

import { Calendar } from "@auction/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { TextInput, type TextInputProps, useField } from "@auction/ui/lax";
import { CalendarDays } from "lucide-react";
import * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { STAFF_TIME_ZONE, formatStaffDate, londonZoneLabel } from "../lib/format.js";
import { StaffButton } from "../primitives/button.js";

/*
 * Dates are typed first ("24 Oct 2026", "24/10/2026", "2026-10-24"); the calendar is a shortcut,
 * never the only way in. Days are whole London calendar days as `YYYY-MM-DD`. Moments (a sale
 * opening, a lot closing) are typed as a London date and a 24-hour time and stored as ISO UTC,
 * with the zone always shown beside the field.
 */

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

export type ParsedDay = { ok: true; day: string } | { ok: false; reason: "empty" | "invalid" };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function validDay(year: number, month: number, day: number): string | null {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > last) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Reads a typed date, day before month as written in the UK: "24 Oct 2026", "24 October 2026",
 * "24/10/2026", "24-10-2026", "24.10.2026", "24 10 2026" or "2026-10-24".
 */
export function parseStaffDay(input: string): ParsedDay {
  const text = input.trim().toLowerCase().replace(/,/g, " ");
  if (text === "") return { ok: false, reason: "empty" };
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) {
    const day = validDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return day ? { ok: true, day } : { ok: false, reason: "invalid" };
  }
  const parts = text.split(/[\s/.-]+/).filter(Boolean);
  if (parts.length !== 3) return { ok: false, reason: "invalid" };
  const [dayText = "", monthText = "", yearText = ""] = parts;
  const monthIndex = /^\d+$/.test(monthText)
    ? Number(monthText)
    : MONTHS.indexOf(monthText.slice(0, 3) as (typeof MONTHS)[number]) + 1;
  if (!/^\d{1,2}$/.test(dayText) || !/^\d{4}$/.test(yearText) || monthIndex < 1) {
    return { ok: false, reason: "invalid" };
  }
  const day = validDay(Number(yearText), monthIndex, Number(dayText));
  return day ? { ok: true, day } : { ok: false, reason: "invalid" };
}

function dayToDate(day: string): Date | undefined {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function dateToDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "24 Oct 2026" for a `YYYY-MM-DD` day, read as a calendar day (no zone shift). */
export function formatStaffDay(day: string): string {
  return formatStaffDate(`${day}T12:00:00Z`);
}

/** The calendar in the staff style: 32px days, ink for the chosen day, a ring for today. */
function StaffCalendar(props: React.ComponentProps<typeof Calendar>) {
  return (
    <Calendar
      weekStartsOn={1}
      className="bg-transparent p-0 font-staff text-staff-fg [--cell-size:--spacing(8)]"
      classNames={{
        month_caption:
          "flex h-control-sm w-full items-center justify-center px-control-sm text-staff-sm font-medium",
        caption_label: "font-staff text-staff-sm font-medium text-staff-fg",
        button_previous:
          "staff-focus inline-flex size-control-sm items-center justify-center rounded-staff-sm text-staff-fg hover:bg-staff-hover aria-disabled:text-staff-disabled",
        button_next:
          "staff-focus inline-flex size-control-sm items-center justify-center rounded-staff-sm text-staff-fg hover:bg-staff-hover aria-disabled:text-staff-disabled",
        weekday: "flex-1 text-staff-xs font-medium text-staff-muted select-none",
        day: "group/day relative aspect-square size-control-sm p-0 text-center select-none",
        day_button: cn(
          "staff-focus size-control-sm min-w-0 rounded-staff-sm font-staff text-staff-sm font-normal text-staff-fg shadow-none",
          "hover:bg-staff-hover hover:text-staff-fg",
          "data-[selected-single=true]:bg-staff-ink data-[selected-single=true]:text-staff-on-ink data-[selected-single=true]:hover:bg-staff-ink-hover",
          "group-data-[focused=true]/day:ring-0 group-data-[focused=true]/day:border-transparent",
        ),
        today:
          "[&>button]:font-semibold [&>button]:shadow-[inset_0_0_0_1px_var(--color-staff-control-border)]",
        outside: "[&>button]:text-staff-subtle",
        disabled: "[&>button]:text-staff-disabled [&>button]:hover:bg-transparent",
      }}
      {...props}
    />
  );
}

export type DateInputProps = Omit<
  TextInputProps,
  "value" | "defaultValue" | "onChange" | "type" | "trailing" | "min" | "max"
> & {
  /** `YYYY-MM-DD`, or null when empty. */
  value: string | null;
  /** The day typed or picked, or null while the text is empty or not a real date. */
  onValueChange: (day: string | null) => void;
  /** Earliest and latest days that can be picked in the calendar, as `YYYY-MM-DD`. */
  min?: string;
  max?: string;
  /** Leaves out the calendar button, e.g. for dates of birth typed from a document. */
  noCalendar?: boolean;
};

/**
 * A date typed as text, with a calendar to pick from. While focused, the text stays exactly as
 * typed; on blur it is tidied to "24 Oct 2026" when it reads as a real date.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    { value, onValueChange, min, max, noCalendar = false, onBlur, placeholder, disabled, ...props },
    ref,
  ) => {
    const field = useField();
    const [text, setText] = React.useState(() => (value ? formatStaffDay(value) : ""));
    const [open, setOpen] = React.useState(false);
    const lastEmitted = React.useRef<string | null>(value);
    const isDisabled = disabled ?? field?.disabled ?? false;

    React.useEffect(() => {
      if (value === lastEmitted.current) return;
      lastEmitted.current = value;
      setText(value ? formatStaffDay(value) : "");
    }, [value]);

    const emit = (day: string | null) => {
      lastEmitted.current = day;
      onValueChange(day);
    };

    const selected = value ? dayToDate(value) : undefined;
    const fromDate = min ? dayToDate(min) : undefined;
    const toDate = max ? dayToDate(max) : undefined;

    return (
      <TextInput
        ref={ref}
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder ?? "e.g. 24 Oct 2026"}
        disabled={isDisabled}
        className="tabular-nums"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = parseStaffDay(event.target.value);
          emit(parsed.ok ? parsed.day : null);
        }}
        onBlur={(event) => {
          const parsed = parseStaffDay(text);
          if (parsed.ok) setText(formatStaffDay(parsed.day));
          onBlur?.(event);
        }}
        trailing={
          noCalendar || field?.readOnly ? null : (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <StaffButton
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Choose from a calendar"
                  disabled={isDisabled}
                  className="-mr-1.5"
                >
                  <CalendarDays aria-hidden />
                </StaffButton>
              </PopoverTrigger>
              <PopoverContent
                {...STAFF_LAYER}
                align="end"
                sideOffset={8}
                className="w-auto rounded-staff-md border border-staff-line bg-staff-raised p-3 text-staff-fg shadow-staff-md"
              >
                <StaffCalendar
                  mode="single"
                  selected={selected}
                  {...(selected ? { defaultMonth: selected } : {})}
                  {...(fromDate || toDate
                    ? {
                        disabled: [
                          ...(fromDate ? [{ before: fromDate }] : []),
                          ...(toDate ? [{ after: toDate }] : []),
                        ],
                      }
                    : {})}
                  onSelect={(date: Date | undefined) => {
                    if (!date) return;
                    const day = dateToDay(date);
                    setText(formatStaffDay(day));
                    emit(day);
                    setOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          )
        }
        {...props}
      />
    );
  },
);
DateInput.displayName = "DateInput";

/** Minutes London is ahead of UTC at that instant: 60 in summer, 0 in winter. */
function londonOffsetMinutes(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STAFF_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((wall - Math.floor(instant / 60_000) * 60_000) / 60_000);
}

/**
 * The UTC instant for a London wall-clock day and time, or null when that time does not exist
 * (the hour skipped when clocks go forward).
 */
export function londonWallTimeToIso(day: string, time: string): string | null {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined) return null;
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  for (const offset of [londonOffsetMinutes(wall - 60 * 60_000), londonOffsetMinutes(wall)]) {
    const instant = wall - offset * 60_000;
    if (londonOffsetMinutes(instant) === offset) return new Date(instant).toISOString();
  }
  return null;
}

/** The London day (`YYYY-MM-DD`) and time (`HH:MM`) of an instant. */
export function isoToLondonWallTime(iso: string): { day: string; time: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STAFF_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** "forward" or "back" when London's clocks change on that day, else null. */
export function londonClockChange(day: string): "forward" | "back" | null {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  const start = londonOffsetMinutes(Date.UTC(y, m - 1, d, 0, 30));
  const end = londonOffsetMinutes(Date.UTC(y, m - 1, d, 23, 30));
  if (start === end) return null;
  return end > start ? "forward" : "back";
}

/** Reads "14:05", "1405" or "9:30" on a 24-hour clock. */
export function parseStaffTime(input: string): string | null {
  const match = /^(\d{1,2}):?(\d{2})$/.exec(input.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

export type DateTimeInputProps = {
  /** ISO UTC instant, or null when empty. */
  value: string | null;
  /** The instant typed, or null while the date or time is empty, not real, or does not exist. */
  onValueChange: (iso: string | null) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  /** Names the time field for assistive technology; the date takes the Field's label. */
  timeLabel?: string;
  className?: string;
};

/**
 * A scheduled moment: a London date and a 24-hour time, with the zone fixed beside them
 * ("Europe/London (BST)"). On a day the clocks change, a line under the fields says so; a time in
 * the skipped hour is not accepted.
 */
export function DateTimeInput({
  value,
  onValueChange,
  min,
  max,
  disabled,
  timeLabel = "Time, 24-hour clock",
  className,
}: DateTimeInputProps) {
  const initial = value ? isoToLondonWallTime(value) : null;
  const [day, setDay] = React.useState<string | null>(initial?.day ?? null);
  const [timeText, setTimeText] = React.useState(initial?.time ?? "");
  const lastEmitted = React.useRef<string | null>(value);
  const hintId = React.useId();

  React.useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const next = value ? isoToLondonWallTime(value) : null;
    setDay(next?.day ?? null);
    setTimeText(next?.time ?? "");
  }, [value]);

  const time = parseStaffTime(timeText);
  const iso = day && time ? londonWallTimeToIso(day, time) : null;
  const change = day ? londonClockChange(day) : null;
  const zone = londonZoneLabel(iso ?? (day ? `${day}T12:00:00Z` : new Date()));

  const emit = (nextDay: string | null, nextTimeText: string) => {
    const nextTime = parseStaffTime(nextTimeText);
    const next = nextDay && nextTime ? londonWallTimeToIso(nextDay, nextTime) : null;
    lastEmitted.current = next;
    onValueChange(next);
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <DateInput
          value={day}
          onValueChange={(next) => {
            setDay(next);
            emit(next, timeText);
          }}
          {...(min ? { min: min.slice(0, 10) } : {})}
          {...(max ? { max: max.slice(0, 10) } : {})}
          {...(disabled !== undefined ? { disabled } : {})}
          {...(change ? { "aria-describedby": hintId } : {})}
          boxClassName="min-w-40 flex-1"
        />
        <TextInput
          // Its own id: the Field's id belongs to the date, which carries the Field's label.
          id={`${hintId}-time`}
          aria-label={timeLabel}
          inputMode="numeric"
          autoComplete="off"
          placeholder="14:05"
          value={timeText}
          {...(disabled !== undefined ? { disabled } : {})}
          className="tabular-nums"
          boxClassName="w-24"
          onChange={(event) => {
            setTimeText(event.target.value);
            emit(day, event.target.value);
          }}
          onBlur={() => {
            const parsed = parseStaffTime(timeText);
            if (parsed) setTimeText(parsed);
          }}
        />
        <span className="shrink-0 text-staff-sm whitespace-nowrap text-staff-muted">
          Europe/London ({zone})
        </span>
      </div>
      {change ? (
        <p id={hintId} className="text-staff-xs text-staff-muted">
          {change === "forward"
            ? "Clocks go forward an hour on this day (GMT to BST): there is no 01:00 to 01:59."
            : "Clocks go back an hour on this day (BST to GMT): 01:00 to 01:59 happens twice; the first is used."}
        </p>
      ) : null}
    </div>
  );
}
