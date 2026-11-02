"use client";

import { StaffButton, TextInput } from "@auction/staff-ui";
import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";

type Props = {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

const STEP = 0.05;
const STEP_LARGE = 0.25;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * How far to zoom into the picture, from the whole work to a detail: type a value, use the buttons
 * (0.05 a step), or press the arrow keys in the field (Shift for 0.25). A typed value outside the
 * range is held to it.
 */
export function ZoomStepper({ value, min, max, disabled = false, onChange }: Props) {
  const id = useId();
  const [text, setText] = useState(value.toFixed(2));

  useEffect(() => {
    setText(value.toFixed(2));
  }, [value]);

  const commit = (next: number) => onChange(round(clamp(next, min, max)));

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-staff-sm font-medium text-staff-fg">
        Zoom
      </label>
      <div className="flex items-center gap-2">
        <StaffButton
          variant="secondary"
          size="sm"
          aria-label="Zoom out"
          icon={<Minus />}
          disabled={disabled || value <= min}
          onClick={() => commit(value - STEP)}
        />
        <TextInput
          id={id}
          size="sm"
          inputMode="decimal"
          className="w-24 text-center tabular-nums"
          value={text}
          disabled={disabled}
          onChange={(event) => {
            setText(event.target.value);
            const typed = Number(event.target.value.replace(",", "."));
            if (Number.isFinite(typed) && typed >= min && typed <= max) onChange(round(typed));
          }}
          onBlur={() => {
            const typed = Number(text.replace(",", "."));
            if (Number.isFinite(typed)) commit(typed);
            else setText(value.toFixed(2));
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
            event.preventDefault();
            const step = event.shiftKey ? STEP_LARGE : STEP;
            commit(value + (event.key === "ArrowUp" ? step : -step));
          }}
        />
        <StaffButton
          variant="secondary"
          size="sm"
          aria-label="Zoom in"
          icon={<Plus />}
          disabled={disabled || value >= max}
          onClick={() => commit(value + STEP)}
        />
        <span className="text-staff-sm text-staff-muted">
          {min.toFixed(1)} shows the whole picture; {max.toFixed(1)} is the closest detail.
        </span>
      </div>
    </div>
  );
}
