"use client";

import { CircleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";

export type ChoiceFieldsetProps = {
  legend: React.ReactNode;
  description?: React.ReactNode;
  /** Shown beside the legend, like `Field optional`. */
  optional?: boolean;
  error?: string | null | undefined;
  /** The id an error summary links to; the fieldset takes focus, so its question shows. */
  id?: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * A group of radios, checkboxes or several small inputs that answer one question, with the same
 * rhythm as `Field`: legend 13/20 medium, guidance 12/16 muted, the controls, then the inline
 * error with its icon. The error is read with the group, and an error summary link can focus it.
 */
export function ChoiceFieldset({
  legend,
  description,
  optional = false,
  error,
  id,
  disabled = false,
  className,
  children,
}: ChoiceFieldsetProps) {
  const autoId = React.useId();
  const baseId = id ?? `fieldset-${autoId}`;
  const descriptionId = description ? `${baseId}-description` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset
      id={baseId}
      tabIndex={-1}
      disabled={disabled}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      className={cn("staff-focus flex min-w-0 flex-col gap-1.5 rounded-staff-sm", className)}
    >
      {/* The legend must be the fieldset's first child to name the group. */}
      <legend
        className={cn(
          "flex items-baseline gap-2 p-0 text-staff-sm font-medium text-staff-fg",
          disabled && "text-staff-disabled",
        )}
      >
        {legend}
        {optional ? (
          <span className="text-staff-xs font-normal text-staff-subtle">Optional</span>
        ) : null}
      </legend>
      {description ? (
        <p id={descriptionId} className="-mt-1 text-staff-xs text-staff-muted">
          {description}
        </p>
      ) : null}
      {children}
      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-staff-xs font-medium text-staff-danger"
        >
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
