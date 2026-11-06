"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { useCallback, useEffect, useRef } from "react";
import { accountTriggerName } from "./account-display-name.js";

/** How long the toast stays before it leaves by itself. */
export const SIGNED_IN_TOAST_MS = 6000;

/** "Alex" from "Alex Member"; the part of the email before the "@" without a name. */
export function signedInFirstName(displayName: string | null | undefined, email: string): string {
  return accountTriggerName(displayName ?? "", email);
}

export type MarketingSignedInToastProps = {
  /** The toast shows while true. The live region stays in the page either way. */
  open: boolean;
  /** The person's first name (see `signedInFirstName`). */
  firstName: string;
  /** "Not you?": signs the person out. The host also closes the toast. */
  onNotYou: () => void;
  /** The toast leaves: after `durationMs`, or on Escape from inside it. */
  onDismiss: () => void;
  /** Disables "Not you?" while the sign-out runs. */
  pending?: boolean;
  durationMs?: number;
  "data-testid"?: string;
};

/**
 * The first-visit "Signed in as Alex · Not you?" notice for every LAX product, in place of a modal
 * dialog. It sits in the corner and blocks nothing: no overlay, no focus is moved or trapped, and
 * "Not you?" is an ordinary button in the tab order. A polite live region announces it. It leaves
 * after six seconds, paused while the pointer or focus is on it so it can be read and used.
 */
export function MarketingSignedInToast({
  open,
  firstName,
  onNotYou,
  onDismiss,
  pending = false,
  durationMs = SIGNED_IN_TOAST_MS,
  "data-testid": testId = "silent-sign-in-notice",
}: MarketingSignedInToastProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const clear = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const start = useCallback(() => {
    clear();
    timer.current = setTimeout(() => dismissRef.current(), durationMs);
  }, [clear, durationMs]);

  useEffect(() => {
    if (!open) return;
    start();
    return clear;
  }, [open, start, clear]);

  return (
    <output
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-[calc(var(--lax-bottom-bar-space,0px)+1rem)] left-4 right-4 z-50 flex justify-end sm:left-auto sm:max-w-sm"
    >
      {open ? (
        <div
          data-testid={testId}
          className={cn(
            "pointer-events-auto flex items-center gap-3 rounded-lg border border-border-hairline bg-surface px-4 py-3",
            "font-body text-sm leading-5 text-on-surface shadow-lg",
          )}
          onMouseEnter={clear}
          onMouseLeave={start}
          onFocus={clear}
          onBlur={start}
          onKeyDown={(event) => {
            if (event.key === "Escape") onDismiss();
          }}
        >
          <span>
            Signed in as <strong className="font-medium">{firstName}</strong>
          </span>
          <span aria-hidden="true" className="text-on-surface-variant">
            ·
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={onNotYou}
            className={cn(
              "min-h-6 rounded-sm font-medium underline underline-offset-4 disabled:opacity-60",
              FOCUS_RING,
            )}
          >
            Not you?
          </button>
        </div>
      ) : null}
    </output>
  );
}
