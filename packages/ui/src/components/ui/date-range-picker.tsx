"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
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
  /** Called when a preset is chosen (from/to already applied) */
  onPreset?: (preset: DateRangePreset) => void;
};

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function applyPreset(preset: DateRangePreset): DateRangeValue {
  const end = new Date();
  const start = new Date();
  if (preset === "today") {
    return { from: toYmd(start), to: toYmd(end) };
  }
  const days =
    preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 30;
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { from: toYmd(start), to: toYmd(end) };
}

const presets: { id: DateRangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
];

export function DateRangePicker({ value, onChange, className, onPreset }: DateRangePickerProps) {
  const [mode, setMode] = React.useState<DateRangePreset>("30d");

  const apply = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setMode("custom");
      onPreset?.(preset);
      return;
    }
    setMode(preset);
    const next = applyPreset(preset);
    onChange(next);
    onPreset?.(preset);
  };

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4", className)}>
      {/* biome-ignore lint/a11y/useSemanticElements: <explanation> */}
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="date-from" className="text-xs text-on-surface-variant">
            From
          </Label>
          <input
            id="date-from"
            type="date"
            value={value.from}
            onChange={(e) => {
              setMode("custom");
              onChange({ ...value, from: e.target.value });
              onPreset?.("custom");
            }}
            className="rounded-md border border-outline-variant/25 bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="date-to" className="text-xs text-on-surface-variant">
            To
          </Label>
          <input
            id="date-to"
            type="date"
            value={value.to}
            onChange={(e) => {
              setMode("custom");
              onChange({ ...value, to: e.target.value });
              onPreset?.("custom");
            }}
            className="rounded-md border border-outline-variant/25 bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface"
          />
        </div>
      </div>
    </div>
  );
}
