"use client";

import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { StaffButton, cn } from "@auction/staff-ui";
import type { UnitPoint, UnitRect } from "@auction/types";
import { useId, useRef, useState } from "react";

type Props = {
  /** Storage key of the picture to draw. */
  pictureKey: string;
  size: { width: number; height: number } | null;
  focal: UnitPoint;
  keep: UnitRect | undefined;
  onFocalChange: (focal: UnitPoint) => void;
  onKeepChange: (keep: UnitRect | undefined) => void;
  /** Describes the picture for the editor's accessible name. */
  label: string;
  disabled?: boolean;
};

const EDITOR_MAX_HEIGHT_PX = 360;
const FALLBACK_RATIO = 4 / 3;
/** A pointer that moves less than this many pixels set the focal point; more draws the keep area. */
const DRAG_THRESHOLD_PX = 5;
const MIN_KEEP = 0.05;
const NUDGE = 0.01;
const NUDGE_LARGE = 0.05;
const DEFAULT_KEEP_SHARE = 0.5;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

function rectBetween(a: UnitPoint, b: UnitPoint): UnitRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

type Target = "focal" | "keep";

/**
 * The picture with its focal point and keep-in-frame area. Click to set the focal point; drag to
 * draw the area that must stay in every crop. From the keyboard, Tab to the picture, choose what
 * the arrow keys move (the focal point or the keep area; Shift moves further, Alt resizes the
 * area) and press Delete to clear the area.
 */
export function FocalKeepEditor({
  pictureKey,
  size,
  focal,
  keep,
  onFocalChange,
  onKeepChange,
  label,
  disabled = false,
}: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [target, setTarget] = useState<Target>("focal");
  const [drag, setDrag] = useState<{ from: UnitPoint; to: UnitPoint; moved: boolean } | null>(null);
  const src = resolveMediaSrc(pictureKey);
  const ratio = size ? size.width / size.height : FALLBACK_RATIO;
  const shownKeep = drag?.moved ? rectBetween(drag.from, drag.to) : keep;

  const pointAt = (event: React.PointerEvent): UnitPoint => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0.5, y: 0.5 };
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = pointAt(event);
    setDrag({ from: at, to: at, moved: false });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    const rect = surface.current?.getBoundingClientRect();
    const to = pointAt(event);
    const movedPx = rect
      ? Math.hypot((to.x - drag.from.x) * rect.width, (to.y - drag.from.y) * rect.height)
      : 0;
    setDrag({ ...drag, to, moved: drag.moved || movedPx > DRAG_THRESHOLD_PX });
  };

  const onPointerUp = () => {
    if (!drag) return;
    if (!drag.moved) {
      onFocalChange({ x: round(drag.from.x), y: round(drag.from.y) });
    } else {
      const next = rectBetween(drag.from, drag.to);
      if (next.width >= MIN_KEEP && next.height >= MIN_KEEP) {
        onKeepChange({
          x: round(next.x),
          y: round(next.y),
          width: round(next.width),
          height: round(next.height),
        });
      }
    }
    setDrag(null);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      if (keep) {
        event.preventDefault();
        onKeepChange(undefined);
      }
      return;
    }
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key] as [number, number] | undefined;
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? NUDGE_LARGE : NUDGE;
    const [dx, dy] = direction;
    if (target === "focal") {
      onFocalChange({
        x: round(clamp01(focal.x + dx * step)),
        y: round(clamp01(focal.y + dy * step)),
      });
      return;
    }
    const current: UnitRect = keep ?? {
      x: (1 - DEFAULT_KEEP_SHARE) / 2,
      y: (1 - DEFAULT_KEEP_SHARE) / 2,
      width: DEFAULT_KEEP_SHARE,
      height: DEFAULT_KEEP_SHARE,
    };
    if (event.altKey) {
      const width = Math.min(1 - current.x, Math.max(MIN_KEEP, current.width + dx * step));
      const height = Math.min(1 - current.y, Math.max(MIN_KEEP, current.height + dy * step));
      onKeepChange({ ...current, width: round(width), height: round(height) });
      return;
    }
    onKeepChange({
      ...current,
      x: round(Math.min(1 - current.width, Math.max(0, current.x + dx * step))),
      y: round(Math.min(1 - current.height, Math.max(0, current.y + dy * step))),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center justify-center rounded-staff-md bg-staff-sunken p-4"
        style={{ minHeight: 160 }}
      >
        <div
          ref={surface}
          // biome-ignore lint/a11y/useSemanticElements: a picture with a movable point is a custom control
          role="group"
          tabIndex={disabled ? -1 : 0}
          aria-label={`${label}. Focal point at ${Math.round(focal.x * 100)}% across and ${Math.round(focal.y * 100)}% down${keep ? ", with an area to keep in frame" : ""}.`}
          aria-describedby={disabled ? undefined : hintId}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
          onKeyDown={onKeyDown}
          className={cn(
            "staff-focus relative touch-none select-none overflow-hidden rounded-staff-sm bg-staff-surface",
            disabled ? "cursor-default" : "cursor-crosshair",
          )}
          style={{
            aspectRatio: String(ratio),
            width: `min(100%, ${Math.round(EDITOR_MAX_HEIGHT_PX * ratio)}px)`,
          }}
        >
          {src ? (
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 size-full"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-staff-sm text-staff-muted">
              Picture unavailable
            </span>
          )}
          {shownKeep ? (
            <span
              data-testid="keep-area"
              className="pointer-events-none absolute border border-dashed border-staff-warning-fg bg-staff-warning-bg/50"
              style={{
                left: `${shownKeep.x * 100}%`,
                top: `${shownKeep.y * 100}%`,
                width: `${shownKeep.width * 100}%`,
                height: `${shownKeep.height * 100}%`,
              }}
            >
              <span className="absolute right-0 bottom-0 rounded-tl-staff-xs bg-staff-warning-fg px-1.5 text-staff-xs font-medium text-staff-surface">
                Keep in frame
              </span>
            </span>
          ) : null}
          <span
            data-testid="focal-point"
            aria-hidden
            className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgb(0_0_0/0.7),inset_0_0_0_1.5px_rgb(0_0_0/0.7)]"
            style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
          />
        </div>
      </div>
      {disabled ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={hintId} className="text-staff-sm text-staff-muted">
            Click to set the focal point, drag a box to keep in frame. With the keyboard, the arrow
            keys move the {target === "focal" ? "focal point" : "keep area"}; Shift moves further
            {target === "keep" ? ", Alt resizes" : ""}.
          </p>
          <div className="flex items-center gap-2">
            <StaffButton
              size="sm"
              variant="secondary"
              disabled={disabled}
              aria-pressed={target === "keep"}
              onClick={() => setTarget(target === "focal" ? "keep" : "focal")}
            >
              {target === "focal" ? "Move keep area instead" : "Move focal point instead"}
            </StaffButton>
            {keep ? (
              <StaffButton
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => onKeepChange(undefined)}
              >
                Clear keep area
              </StaffButton>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
