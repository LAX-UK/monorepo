"use client";

import { CircleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils.js";

const ReadOnlyContext = React.createContext(false);

/**
 * Marks everything below it as a view of a record, not a form: fields show their values at
 * normal contrast with no editing affordance, selects and checkboxes show the chosen value, and
 * the controls that would change it are left to each page's own permission checks.
 */
export function ReadOnlyView({
  readOnly = true,
  children,
}: {
  readOnly?: boolean;
  children: React.ReactNode;
}) {
  const inherited = React.useContext(ReadOnlyContext);
  return (
    <ReadOnlyContext.Provider value={readOnly || inherited}>{children}</ReadOnlyContext.Provider>
  );
}

/** Whether the surrounding form is being shown as a read-only view. */
export function useReadOnlyView(): boolean {
  return React.useContext(ReadOnlyContext);
}

/**
 * How a read-only control draws its value: the field box without the control look, at the
 * foreground colour, so values read as content and not as disabled controls.
 */
export const readOnlyBox =
  "data-[readonly]:cursor-default data-[readonly]:border-lax-line! data-[readonly]:bg-transparent! data-[readonly]:text-lax-fg!";

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
export function useField(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

export type FieldProps = {
  label: React.ReactNode;
  /** Short guidance under the label, read with the control. */
  description?: React.ReactNode;
  /** Shown under the control and announced; marks the control invalid. */
  error?: string | null | undefined;
  /** Marks the label "Optional" instead; required is the default. */
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
  const readOnly = useReadOnlyView();
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
            "flex items-baseline gap-2 text-lax-ui font-medium text-lax-fg",
            disabled && "text-lax-disabled-fg",
          )}
        >
          {label}
          {optional ? (
            <span className="text-lax-12 font-normal text-lax-subtle">Optional</span>
          ) : null}
        </label>
        {description ? (
          <p id={descriptionId} className="text-lax-12 text-lax-muted">
            {description}
          </p>
        ) : null}
      </div>
      <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-lax-12 font-medium text-lax-danger"
        >
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
