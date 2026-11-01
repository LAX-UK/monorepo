"use client";

import { useId } from "react";

type Props = {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

const STEP = 0.05;

/** How far to zoom into the picture, from the whole work to a detail. Arrow keys move by 0.05. */
export function ZoomSlider({ value, min, max, disabled = false, onChange }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-staff-sm font-medium text-staff-fg">
        Zoom
      </label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={STEP}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Math.round(Number(event.target.value) * 100) / 100)}
          className="staff-focus h-5 flex-1 cursor-pointer accent-staff-ink disabled:cursor-not-allowed"
        />
        <output
          htmlFor={id}
          className="w-14 text-right text-staff-sm font-medium text-staff-fg tabular-nums"
        >
          × {value.toFixed(2)}
        </output>
      </div>
      <p className="text-staff-xs text-staff-muted">
        {min.toFixed(1)} shows the whole picture; {max.toFixed(1)} is the closest detail.
      </p>
    </div>
  );
}
