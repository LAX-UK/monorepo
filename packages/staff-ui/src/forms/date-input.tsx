"use client";

import { clockChangeNotice, shortZoneName } from "@auction/datetime";
import { Calendar } from "@auction/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { TextInput, type TextInputProps, useField } from "@auction/ui/lax";
import { CalendarDays } from "lucide-react";
import * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { STAFF_TIME_ZONE } from "../lib/format.js";
import { StaffButton } from "../primitives/button.js";
import {
  dateToDay,
  dayToDate,
  formatStaffDay,
  isoToWallTime,
  parseStaffDay,
  parseStaffTime,
  wallTimeToIso,
} from "./staff-dates.js";

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

export type DateTimeInputProps = {
  /** ISO UTC instant, or null when empty. */
  value: string | null;
  /** The instant typed, or null while the date or time is empty, not real, or does not exist. */
  onValueChange: (iso: string | null) => void;
  /**
   * The day and time as typed, for a caller that keeps them even when they name no instant (a
   * time the clocks skip). Shown when `value` is null, so the typed time stays on screen beside
   * its error.
   */
  wall?: { day: string; time: string } | null;
  /** Called with the day and time typed whenever both read as real, instant or not; else null. */
  onWallChange?: (wall: { day: string; time: string } | null) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  /** Names the time field for assistive technology; the date takes the Field's label. */
  timeLabel?: string;
  /** The zone the date and time are read in: a sale's own zone. London when not given. */
  timeZone?: string;
  /**
   * Whether the zone's name sits beside the fields ("Europe/London (BST)"). A form that states
   * its zone once, in one line for every time on it, turns this off.
   */
  showZone?: boolean;
  className?: string;
};

/**
 * A scheduled moment: a date and a 24-hour time in one zone, with the zone fixed beside them
 * ("Europe/London (BST)"). On a day the clocks change, a line under the fields says so; a time in
 * the skipped hour is not accepted. Changing `timeZone` keeps the date and time as typed and
 * reads them in the new zone.
 */
export function DateTimeInput({
  value,
  onValueChange,
  wall,
  onWallChange,
  min,
  max,
  disabled,
  timeLabel = "Time, 24-hour clock",
  timeZone = STAFF_TIME_ZONE,
  showZone = true,
  className,
}: DateTimeInputProps) {
  const initial = value ? isoToWallTime(value, timeZone) : (wall ?? null);
  const [day, setDay] = React.useState<string | null>(initial?.day ?? null);
  const [timeText, setTimeText] = React.useState(initial?.time ?? "");
  const lastEmitted = React.useRef<string | null>(value);
  const hintId = React.useId();

  const zoneRef = React.useRef(timeZone);

  React.useEffect(() => {
    if (zoneRef.current !== timeZone) {
      // A new zone moves the instant, not what was typed: keep the text and take the new instant
      // as already seen, even when the same time does not exist there.
      zoneRef.current = timeZone;
      lastEmitted.current = value;
      return;
    }
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const next = value ? isoToWallTime(value, timeZone) : (wall ?? null);
    setDay(next?.day ?? null);
    setTimeText(next?.time ?? "");
  }, [value, timeZone, wall]);

  const time = parseStaffTime(timeText);
  const iso = day && time ? wallTimeToIso(day, time, timeZone) : null;
  const change = day ? clockChangeNotice(day, timeZone) : null;
  const zoneName = shortZoneName(
    timeZone,
    new Date(iso ?? (day ? `${day}T12:00:00Z` : Date.now())),
  );
  const missingTime = Boolean(day && time && !iso);

  const emit = (nextDay: string | null, nextTimeText: string) => {
    const nextTime = parseStaffTime(nextTimeText);
    const next = nextDay && nextTime ? wallTimeToIso(nextDay, nextTime, timeZone) : null;
    lastEmitted.current = next;
    onWallChange?.(nextDay && nextTime ? { day: nextDay, time: nextTime } : null);
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
          {...(change || missingTime ? { "aria-describedby": hintId } : {})}
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
        {showZone ? (
          <span className="shrink-0 text-staff-sm whitespace-nowrap text-staff-muted">
            {timeZone} ({zoneName})
          </span>
        ) : null}
      </div>
      {change ? (
        <p id={hintId} className="text-staff-xs text-staff-muted">
          {change}
        </p>
      ) : null}
    </div>
  );
}
