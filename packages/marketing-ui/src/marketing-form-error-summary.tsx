"use client";

import { cn } from "@auction/ui";
import { useEffect, useId, useRef } from "react";
import { MarketingCircleAlertIcon } from "./marketing-icons.js";

export type MarketingFormError = { fieldId: string; message: string };

export type MarketingFormErrorSummaryProps = {
  errors: ReadonlyArray<MarketingFormError>;
  title?: string;
  /**
   * Changes once per failed submit (a submit counter). Focus moves to the summary only when it
   * changes, so errors that clear while the person fixes fields never pull focus away. Keep the
   * summary mounted; it renders nothing without errors.
   */
  focusKey: number;
  className?: string;
};

/** Moves focus to a field and brings its label into view, so the question shows with it. */
function focusField(fieldId: string): boolean {
  const field = document.getElementById(fieldId);
  if (!field) return false;
  const label = document.querySelector(`label[for="${CSS.escape(fieldId)}"]`);
  field.focus({ preventScroll: true });
  (label ?? field).scrollIntoView?.({ block: "center" });
  return document.activeElement === field;
}

/**
 * What to fix after a failed submit, at the top of the form. It takes focus on each failed
 * submit so keyboard and screen reader users land on it, and each message links to its field.
 * The messages are the same words shown at each field.
 */
export function MarketingFormErrorSummary({
  errors,
  title = "There is a problem",
  focusKey,
  className,
}: MarketingFormErrorSummaryProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const focusedFor = useRef<number | null>(null);
  const titleId = useId();
  const visible = errors.length > 0;

  useEffect(() => {
    if (!visible || focusKey === 0 || focusedFor.current === focusKey) return;
    focusedFor.current = focusKey;
    ref.current?.focus();
    ref.current?.scrollIntoView?.({ block: "start" });
  }, [visible, focusKey]);

  if (!visible) return null;
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn("marketing-form-error-summary", className)}
    >
      <MarketingCircleAlertIcon className="marketing-form-error-summary__icon" />
      <div>
        <h2 id={titleId} className="marketing-form-error-summary__title">
          {title}
        </h2>
        <ul className="marketing-form-error-summary__list">
          {errors.map((error) => (
            <li key={error.fieldId}>
              <a
                href={`#${error.fieldId}`}
                className="marketing-form-error-summary__link"
                onClick={(event) => {
                  if (focusField(error.fieldId)) event.preventDefault();
                }}
              >
                {error.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
