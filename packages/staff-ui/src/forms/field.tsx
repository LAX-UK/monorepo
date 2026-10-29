"use client";

import { CircleAlert } from "lucide-react";
import * as React from "react";
import { useStaffReadOnly } from "../access/read-only.js";
import { cn } from "../lib/cn.js";

type FieldContextValue = {
  controlId: string;
  /** The label's id, for controls that are not labelable elements and name themselves with it. */
  labelId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
  /** The form is a read-only view: controls show their value as content. */
  readOnly: boolean;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

/** The ids and state a control inside a `Field` needs for its label, hint and error. */
export function useStaffField(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

export type FieldProps = {
  label: React.ReactNode;
  /** Short guidance under the label, read with the control. */
  description?: React.ReactNode;
  /** Shown under the control and announced; marks the control invalid. */
  error?: string | null | undefined;
  /** Marks the label "Optional" instead; required is the default in staff forms. */
  optional?: boolean;
  disabled?: boolean;
  /** Use when the control renders its own id (e.g. a picker trigger). */
  id?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Label, guidance, control and inline error in one vertical rhythm (label 20, gap 6, control,
 * gap 6, message 16). Controls inside read their ids from context, so every input is labelled
 * and described without wiring ids by hand.
 */
export function Field({
  label,
  description,
  error,
  optional = false,
  disabled = false,
  id,
  className,
  children,
}: FieldProps) {
  const readOnly = useStaffReadOnly();
  const autoId = React.useId();
  const controlId = id ?? `field-${autoId}`;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const labelId = `${controlId}-label`;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const value = React.useMemo(
    () => ({
      controlId,
      labelId,
      describedBy,
      invalid: Boolean(error),
      required: !optional,
      disabled,
      readOnly,
    }),
    [controlId, labelId, describedBy, error, optional, disabled, readOnly],
  );

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex flex-col gap-0.5">
        <label
          id={labelId}
          htmlFor={controlId}
          className={cn(
            "flex items-baseline gap-2 text-staff-sm font-medium text-staff-fg",
            disabled && "text-staff-disabled",
          )}
        >
          {label}
          {optional ? (
            <span className="text-staff-xs font-normal text-staff-subtle">Optional</span>
          ) : null}
        </label>
        {description ? (
          <p id={descriptionId} className="text-staff-xs text-staff-muted">
            {description}
          </p>
        ) : null}
      </div>
      <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-staff-xs font-medium text-staff-danger"
        >
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
