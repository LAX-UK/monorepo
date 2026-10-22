"use client";

import { Label, cn } from "@auction/ui";
import { type ReactNode, createContext, useContext, useId } from "react";

const FormScopeContext = createContext("field");

export const FormScopeProvider = FormScopeContext.Provider;

/** Ids are `<form scope>-<field name>` so the error summary can link to a field by name. */
export function fieldControlId(scope: string, name: string): string {
  return `${scope}-${name}`;
}

/** The control id for a field; unnamed fields (outside the error summary) get a generated name. */
export function useFieldControlId(name: string | undefined): string {
  const scope = useContext(FormScopeContext);
  const generated = useId();
  return fieldControlId(scope, name ?? generated);
}

/** Props a control needs to be labelled, described by its hint and error, and flagged invalid. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

type FormFieldProps = {
  name?: string | undefined;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  className?: string | undefined;
  children: (control: FieldControlProps) => ReactNode;
};

/** Label, optional hint and error message wired to a single control. */
export function FormField({ name, label, hint, error, className, children }: FormFieldProps) {
  const id = useFieldControlId(name);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-invalid": true as const } : {}),
      })}
      {hint ? (
        <p id={hintId} className="text-xs text-on-surface-variant">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
