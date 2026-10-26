"use client";

import * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffButton, type StaffButtonProps } from "./button.js";

/** How long a hold takes by default. Long enough to stop a slip, short enough for a live room. */
export const STAFF_HOLD_MS = 600;

export type HoldButtonProps = Omit<StaffButtonProps, "onClick" | "asChild"> & {
  /** Runs once when the hold completes. Releasing early runs nothing. */
  onHoldComplete: () => void;
  /** How long to hold, in milliseconds. */
  holdMs?: number;
  /** Read with the button: how the hold works. */
  holdHint?: string;
};

const HOLD_KEYS = new Set([" ", "Enter"]);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A button for a consequential action that must be quick but never accidental, such as
 * hammering a lot: press and hold (pointer, touch, or Space or Enter) while a fill grows across
 * the button, and the action runs once when it completes. Releasing early cancels and does
 * nothing; holding on does not repeat. With reduced motion the progress is a plain bar along the
 * bottom instead of a sweep.
 */
export const HoldButton = React.forwardRef<HTMLButtonElement, HoldButtonProps>(
  (
    {
      onHoldComplete,
      holdMs = STAFF_HOLD_MS,
      holdHint = "Press and hold to confirm. Release early to cancel.",
      disabled,
      loading,
      className,
      children,
      onPointerDown,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
      onKeyDown,
      onKeyUp,
      onBlur,
      "aria-describedby": describedBy,
      ...props
    },
    ref,
  ) => {
    const hintId = React.useId();
    const [progress, setProgress] = React.useState(0);
    const [reduced, setReduced] = React.useState(false);
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const frame = React.useRef<number | null>(null);
    const holding = React.useRef(false);
    const fired = React.useRef(false);
    const complete = React.useRef(onHoldComplete);
    complete.current = onHoldComplete;
    const inert = Boolean(disabled) || Boolean(loading) || Boolean(props.disabledReason);

    React.useEffect(() => setReduced(prefersReducedMotion()), []);

    const stopTimers = React.useCallback(() => {
      if (timer.current) clearTimeout(timer.current);
      if (frame.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frame.current);
      }
      timer.current = null;
      frame.current = null;
    }, []);

    React.useEffect(() => stopTimers, [stopTimers]);

    const start = () => {
      if (inert || holding.current) return;
      holding.current = true;
      fired.current = false;
      const began = Date.now();
      setProgress(0);
      timer.current = setTimeout(() => {
        if (!holding.current || fired.current) return;
        fired.current = true;
        setProgress(1);
        if (frame.current !== null && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(frame.current);
        }
        complete.current();
      }, holdMs);
      if (typeof requestAnimationFrame === "function") {
        const tick = () => {
          if (!holding.current || fired.current) return;
          setProgress(Math.min(1, (Date.now() - began) / holdMs));
          frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
      }
    };

    const release = () => {
      if (!holding.current) return;
      holding.current = false;
      stopTimers();
      setProgress(0);
    };

    return (
      <>
        <StaffButton
          ref={ref}
          {...props}
          {...(disabled !== undefined ? { disabled } : {})}
          {...(loading !== undefined ? { loading } : {})}
          aria-describedby={describedBy ? `${hintId} ${describedBy}` : hintId}
          data-holding={progress > 0 && progress < 1 ? "" : undefined}
          className={cn("relative isolate overflow-hidden select-none touch-none", className)}
          // A plain click never runs the action; only a completed hold does.
          onClick={(event) => event.preventDefault()}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            onPointerDown?.(event);
            // Only the main button (or a touch or pen contact) starts a hold.
            if (event.button > 0) return;
            start();
          }}
          onPointerUp={(event) => {
            onPointerUp?.(event);
            release();
          }}
          onPointerLeave={(event) => {
            onPointerLeave?.(event);
            release();
          }}
          onPointerCancel={(event) => {
            onPointerCancel?.(event);
            release();
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!HOLD_KEYS.has(event.key)) return;
            event.preventDefault();
            // Key repeat while held neither restarts nor repeats the action.
            if (!event.repeat) start();
          }}
          onKeyUp={(event) => {
            onKeyUp?.(event);
            if (HOLD_KEYS.has(event.key)) release();
          }}
          onBlur={(event) => {
            onBlur?.(event);
            release();
          }}
        >
          {progress > 0 ? (
            <span
              aria-hidden
              data-hold-progress={Math.round(progress * 100)}
              className={cn(
                "pointer-events-none absolute inset-x-0 -z-10 origin-left bg-current",
                reduced ? "bottom-0 h-1 opacity-60" : "inset-y-0 opacity-15",
              )}
              style={{ transform: `scaleX(${progress})` }}
            />
          ) : null}
          {children}
        </StaffButton>
        <span id={hintId} className="sr-only">
          {holdHint}
        </span>
      </>
    );
  },
);
HoldButton.displayName = "HoldButton";
