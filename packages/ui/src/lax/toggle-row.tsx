"use client";

import { CircleAlert, LoaderCircle, Lock } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils.js";
import { Switch } from "./switch.js";

export type ToggleRowProps = {
  label: string;
  /** One line on what turning it on does: "Lot closing soon". */
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Unavailable for now; the description says when it will be. */
  disabled?: boolean;
  /** Held on by a rule the person cannot change here; the reason is read and shown. */
  lockedReason?: string;
  /** The change is being saved: the switch keeps its new position and shows a spinner. */
  saving?: boolean;
  /** The change failed to save; the message replaces the description. */
  error?: string | null;
  className?: string;
};

/**
 * A setting as a row: label and description on the left, the switch on the right, at least 64px
 * tall. The label names the switch and the description describes it, so the whole row reads as
 * one control. A locked row adds its reason as a line of text at full contrast (and the switch
 * reads it as its description); a failed save says so under the label and announces it.
 */
export function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  lockedReason,
  saving = false,
  error,
  className,
}: ToggleRowProps) {
  const id = React.useId();
  const labelId = `${id}-label`;
  const detailId = `${id}-detail`;
  const detail = error ?? description;
  return (
    <div
      data-toggle-row=""
      className={cn(
        "grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <label
          id={labelId}
          htmlFor={id}
          className={cn(
            "block text-lax-ui font-medium",
            disabled ? "cursor-not-allowed text-lax-muted" : "cursor-pointer text-lax-fg",
          )}
        >
          {label}
        </label>
        {detail ? (
          <p
            id={detailId}
            {...(error ? { role: "alert" } : {})}
            className={cn(
              "mt-0.5 flex items-start gap-1.5 text-lax-13",
              error ? "font-medium text-lax-danger" : "text-lax-muted",
            )}
          >
            {error ? <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : null}
            {detail}
          </p>
        ) : null}
        {lockedReason && !error ? (
          <p className="mt-0.5 flex items-start gap-1.5 text-lax-13 text-lax-fg">
            <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-lax-muted" />
            {lockedReason}
          </p>
        ) : null}
      </div>
      <span className="flex items-center gap-2">
        {saving ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin text-lax-muted" />
        ) : null}
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-busy={saving || undefined}
          {...(lockedReason ? { lockedReason } : {})}
          {...(detail ? { "aria-describedby": detailId } : {})}
        />
      </span>
    </div>
  );
}
