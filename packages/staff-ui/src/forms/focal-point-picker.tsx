"use client";

import { useField } from "@auction/ui/lax";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { type FocalPoint, describeFocal, focalFromKey, focalFromPointer } from "./focal-point.js";

export type FocalPointPickerProps = {
  /** The picture's address. */
  src: string;
  /** The picture's width over its height; omit while it is not known. */
  ratio?: number | undefined;
  value: FocalPoint;
  onValueChange: (point: FocalPoint) => void;
  /** Names the control for screen readers, e.g. "Where the subject is in the cover picture". */
  label: string;
  /** Lets an error summary or a label move focus here; inside a `Field` it takes the field's id. */
  id?: string;
  /** Called with the picture's own pixel size once it has loaded. */
  onImageSize?: (size: { width: number; height: number }) => void;
  disabled?: boolean;
  className?: string;
};

const FALLBACK_RATIO = 3 / 2;
const MAX_HEIGHT_REM = 22;

/**
 * Shows a picture and lets staff mark where its subject is: click or drag on it, or Tab to it and
 * use the arrow keys (Shift moves further, Home centres). The marker is a white ring edged in
 * black so it stays visible on any picture. It never changes the picture; the caller keeps the
 * point. Inside a `Field` it takes the field's id and description and error.
 */
export function FocalPointPicker({
  src,
  ratio,
  value,
  onValueChange,
  label,
  id,
  onImageSize,
  disabled = false,
  className,
}: FocalPointPickerProps) {
  const surface = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const aspect = ratio && ratio > 0 ? ratio : FALLBACK_RATIO;
  const field = useField();
  const hintId = React.useId();
  const controlId = id ?? field?.controlId;
  const describedBy = [field?.describedBy, hintId].filter(Boolean).join(" ");

  const pointAt = (event: React.PointerEvent) => {
    const rect = surface.current?.getBoundingClientRect();
    return rect ? focalFromPointer(event, rect) : value;
  };

  return (
    <div
      ref={surface}
      id={controlId}
      role="application"
      aria-roledescription="picture focal point"
      aria-label={label}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        onValueChange(pointAt(event));
      }}
      onPointerMove={(event) => {
        if (dragging) onValueChange(pointAt(event));
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(event) => {
        if (disabled) return;
        const next = focalFromKey(value, event.key, event.shiftKey);
        if (!next) return;
        event.preventDefault();
        onValueChange(next);
      }}
      // The box is exactly the picture's shape and never taller than the cap, so the marker's
      // percentages are the picture's.
      style={{ aspectRatio: aspect, maxWidth: `${MAX_HEIGHT_REM * aspect}rem` }}
      className={cn(
        "staff-focus relative mx-auto w-full touch-none select-none overflow-hidden rounded-staff-lg border border-staff-line bg-staff-sunken",
        disabled ? "cursor-not-allowed" : dragging ? "cursor-grabbing" : "cursor-crosshair",
        className,
      )}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth > 0 && naturalHeight > 0) {
            onImageSize?.({ width: naturalWidth, height: naturalHeight });
          }
        }}
        className="pointer-events-none absolute inset-0 size-full object-cover"
      />
      <span id={hintId} className="sr-only">
        {describeFocal(value)}. Use the arrow keys to move it, Shift for larger steps, Home to
        centre.
      </span>
      <span
        aria-hidden
        style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
        className={cn(
          "pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.65),inset_0_0_0_1.5px_rgba(0,0,0,0.65)]",
          disabled && "opacity-60",
        )}
      />
    </div>
  );
}
