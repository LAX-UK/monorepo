"use client";

import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { DEFAULT_AUCTION_ZONE, toDateFormString } from "../../lib/datetime/index.js";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import { Calendar } from "./calendar.js";
import { DatePicker } from "./date-picker.js";
import { Label } from "./label.js";

export type DateRangeValue = {
  from: string;
  to: string;
};

export type DateRangePreset = "today" | "7d" | "30d" | "90d" | "custom";

export type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  className?: string;
  zone?: string;
  /** Called when a preset is chosen (from/to already applied) */
  onPreset?: (preset: DateRangePreset) => void;
};

function toYmd(d: Date, zone: string): string {
  return toDateFormString(d, zone);
}

function applyPreset(preset: DateRangePreset, zone: string): DateRangeValue {
  const end = new TZDate(new Date(), zone);
  const endInstant = new Date(end.getTime());
  if (preset === "today") {
    const ymd = toYmd(endInstant, zone);
    return { from: ymd, to: ymd };
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 30;
  const start = addDays(new TZDate(endInstant, zone), -(days - 1));
  return { from: toYmd(new Date(start.getTime()), zone), to: toYmd(endInstant, zone) };
}

const presets: { id: DateRangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
];

function parseRange(value: DateRangeValue): DateRange | undefined {
  if (!value.from && !value.to) return undefined;
  const from = value.from ? new Date(`${value.from}T00:00:00`) : undefined;
  const to = value.to ? new Date(`${value.to}T00:00:00`) : undefined;
  if (!from && !to) return undefined;
  return { from, to };
}

export function DateRangePicker({
  value,
  onChange,
  className,
  zone = DEFAULT_AUCTION_ZONE,
  onPreset,
}: DateRangePickerProps) {
  const [mode, setMode] = React.useState<DateRangePreset>("30d");

  const apply = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setMode("custom");
      onPreset?.(preset);
      return;
    }
    setMode(preset);
    const next = applyPreset(preset, zone);
    onChange(next);
    onPreset?.(preset);
  };

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4", className)}>
      {/* biome-ignore lint/a11y/useSemanticElements: preset toolbar */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Date range presets">
        {presets.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={mode === p.id ? "default" : "outline"}
            className="font-label text-xs uppercase tracking-widest"
            onClick={() => apply(p.id)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={mode === "custom" ? "default" : "outline"}
          className="font-label text-xs uppercase tracking-widest"
          onClick={() => apply("custom")}
        >
          Custom
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <Label htmlFor="date-from" className="text-xs text-on-surface-variant">
              From
            </Label>
            <DatePicker
              id="date-from"
              value={value.from}
              zone={zone}
              onChange={(from) => {
                setMode("custom");
                onChange({ ...value, from });
                onPreset?.("custom");
              }}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="date-to" className="text-xs text-on-surface-variant">
              To
            </Label>
            <DatePicker
              id="date-to"
              value={value.to}
              zone={zone}
              onChange={(to) => {
                setMode("custom");
                onChange({ ...value, to });
                onPreset?.("custom");
              }}
            />
          </div>
        </div>
        {mode === "custom" ? (
          <Calendar
            mode="range"
            timeZone={zone}
            selected={parseRange(value)}
            onSelect={(range) => {
              if (!range) return;
              setMode("custom");
              onChange({
                from: range.from ? toYmd(range.from, zone) : value.from,
                to: range.to ? toYmd(range.to, zone) : value.to,
              });
              onPreset?.("custom");
            }}
            numberOfMonths={2}
            className="rounded-md border border-outline-variant/25 p-2"
          />
        ) : null}
      </div>
    </div>
  );
}
