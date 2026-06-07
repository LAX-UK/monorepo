"use client";

import { cn } from "../../lib/utils.js";
import { Surface } from "./surface.js";

export type WizardContextStripTone = "default" | "error";

export type WizardContextStripProps = {
  /** One-line explainer for the current flow context (e.g. "Private draft…"). */
  explainer: string;
  /** Optional status line (e.g. autosave "Saved · 14:30"). */
  statusText?: string;
  /** Tone for the status line. */
  statusTone?: WizardContextStripTone;
  className?: string;
};

/** Context banner shown atop a wizard: explainer + optional status line. */
export function WizardContextStrip({
  explainer,
  statusText,
  statusTone = "default",
  className,
}: WizardContextStripProps) {
  return (
    <Surface
      variant="quiet"
      padding="sm"
      className={cn("border border-border-hairline", className)}
      data-testid="wizard-context-strip"
    >
      <p className="font-body text-sm text-on-surface-variant">{explainer}</p>
      {statusText ? (
        <p
          className={cn(
            "mt-2 font-label text-[10px] uppercase tracking-wider",
            statusTone === "error" ? "text-live-red" : "text-on-surface-variant",
          )}
          aria-live="polite"
          data-testid="wizard-context-status"
        >
          {statusText}
        </p>
      ) : null}
    </Surface>
  );
}
