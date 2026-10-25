import { cn } from "@auction/ui";
import type { ReactNode } from "react";

/** What a field's control needs so its label, hint and error are read with it. */
export type MarketingFormControlProps = {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

export type MarketingFormFieldProps = {
  id: string;
  label: ReactNode;
  /** Adds "(optional)" to the label; required fields carry no marker. */
  optional?: boolean;
  /** Why the question is asked or the format expected, shown under the label. */
  hint?: ReactNode;
  /** Shown under the label (above the control) and linked to it; the control is marked invalid. */
  error?: string | null;
  className?: string;
  children: (control: MarketingFormControlProps) => ReactNode;
};

/**
 * One question in a consumer form: label, optional hint, the error when there is one, then the
 * control. The control gets the ids that tie the hint and error to it, so a screen reader reads
 * the label, the error and the hint together. The error text matches the error summary's link.
 */
export function MarketingFormField({
  id,
  label,
  optional,
  hint,
  error,
  className,
  children,
}: MarketingFormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("marketing-form-field", error && "marketing-form-field--error", className)}>
      <label htmlFor={id} className="marketing-form-field__label">
        {label}
        {optional ? <span className="marketing-form-field__optional"> (optional)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="marketing-form-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="marketing-form-field__error">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      ) : null}
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
    </div>
  );
}
