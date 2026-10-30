"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { Count, Field, TextInput } from "@auction/ui/lax";
import { CalendarDays } from "lucide-react";
import * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

export type DayRange = { from: string; to: string };

const LONDON_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in London as `YYYY-MM-DD`; staff work in UK time whatever their laptop says. */
export function londonToday(now: Date = new Date()): string {
  return LONDON_DAY.format(now);
}

/** The day `count` days before `day` (`YYYY-MM-DD`). */
export function daysBefore(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - count);
  return date.toISOString().slice(0, 10);
}

export type DateRangePreset = { id: string; label: string; range: (today: string) => DayRange };

export const DEFAULT_DATE_PRESETS: readonly DateRangePreset[] = [
  { id: "today", label: "Today", range: (today) => ({ from: today, to: today }) },
  { id: "7d", label: "Last 7 days", range: (today) => ({ from: daysBefore(today, 6), to: today }) },
  {
    id: "30d",
    label: "Last 30 days",
    range: (today) => ({ from: daysBefore(today, 29), to: today }),
  },
];

/**
 * A date range as a button that opens presets and two date fields. Days are whole calendar days
 * (`YYYY-MM-DD`); a range entered the wrong way round is swapped, so choosing the end first works.
 */
export function DateRangeFilter({
  label,
  value,
  onChange,
  presets = DEFAULT_DATE_PRESETS,
  today,
}: {
  label: string;
  value: { from: string; to: string };
  onChange: (range: DayRange) => void;
  presets?: readonly DateRangePreset[];
  /** Overrides the current London day, for tests. */
  today?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = today ?? londonToday();
  const active = value.from || value.to ? 1 : 0;
  const apply = (range: DayRange) =>
    onChange(
      range.from && range.to && range.from > range.to ? { from: range.to, to: range.from } : range,
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <StaffButton
          size="sm"
          variant="secondary"
          icon={<CalendarDays aria-hidden />}
          className={cn(active > 0 && "border-staff-line-hover")}
        >
          {label}
          {active > 0 ? <Count value={active} tone="attention" /> : null}
        </StaffButton>
      </PopoverTrigger>
      <PopoverContent
        {...STAFF_LAYER}
        align="start"
        sideOffset={6}
        className="w-72 rounded-staff-md border border-staff-line bg-staff-raised p-3 text-staff-fg shadow-staff-md"
      >
        <div className="flex flex-col gap-3">
          <ul aria-label={`${label} presets`} className="flex flex-wrap gap-1.5">
            {presets.map((preset) => {
              const range = preset.range(current);
              const selected = range.from === value.from && range.to === value.to;
              return (
                <li key={preset.id}>
                  <StaffButton
                    size="sm"
                    variant={selected ? "primary" : "secondary"}
                    aria-pressed={selected}
                    onClick={() => {
                      apply(range);
                      setOpen(false);
                    }}
                  >
                    {preset.label}
                  </StaffButton>
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From" optional>
              <TextInput
                size="sm"
                type="date"
                max={value.to || undefined}
                value={value.from}
                onChange={(event) => apply({ from: event.target.value, to: value.to })}
              />
            </Field>
            <Field label="To" optional>
              <TextInput
                size="sm"
                type="date"
                min={value.from || undefined}
                value={value.to}
                onChange={(event) => apply({ from: value.from, to: event.target.value })}
              />
            </Field>
          </div>
          {active > 0 ? (
            <StaffButton
              size="sm"
              variant="ghost"
              className="self-start"
              onClick={() => {
                apply({ from: "", to: "" });
                setOpen(false);
              }}
            >
              Clear dates
            </StaffButton>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
