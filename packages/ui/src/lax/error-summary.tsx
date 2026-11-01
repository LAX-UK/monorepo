"use client";

import { CircleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils.js";

export type ErrorSummaryItem = {
  /** The id of the invalid control, so the line can move focus to it. */
  fieldId: string;
  /** The same sentence the field shows under itself. */
  message: string;
};

export type ErrorSummaryProps = {
  errors: readonly ErrorSummaryItem[];
  title?: string;
  /**
   * Changes once per failed submit (a submit counter). Focus moves to the summary only when the
   * key changes, so errors that clear while the person fixes fields never pull focus away. Keep
   * the summary mounted: it renders nothing without errors and remembers the last key.
   */
  focusKey?: string | number;
  className?: string;
};

/** Focuses the control with this id; false when it cannot (the link then follows its hash). */
function focusControl(fieldId: string): boolean {
  const control = document.getElementById(fieldId);
  if (!control) return false;
  control.focus();
  control.scrollIntoView?.({ block: "center" });
  return true;
}

/**
 * What to fix after a failed submit, at the top of the form: the danger notice with one link per
 * invalid field. It takes focus on each failed submit, so keyboard and screen reader users land on
 * it, and each line moves focus to its field. Messages match the inline errors word for word.
 */
export const ErrorSummary = React.forwardRef<HTMLDivElement, ErrorSummaryProps>(
  function ErrorSummary(
    { errors, title = "There is a problem", focusKey, className },
    forwardedRef,
  ) {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const focusedFor = React.useRef<unknown>(Symbol("never focused"));
    const titleId = React.useId();
    const visible = errors.length > 0;

    React.useImperativeHandle(forwardedRef, () => ref.current as HTMLDivElement);

    React.useEffect(() => {
      if (!visible) return;
      if (focusKey !== undefined) {
        if (focusedFor.current === focusKey) return;
        focusedFor.current = focusKey;
      }
      ref.current?.focus();
    }, [visible, focusKey]);

    if (!visible) return null;
    return (
      <div
        ref={ref}
        role="alert"
        tabIndex={-1}
        aria-labelledby={titleId}
        data-tone="danger"
        className={cn(
          "lax-focus flex gap-2.5 rounded-lax-card border border-lax-danger/30 bg-lax-danger-bg px-3 py-2.5 text-lax-ui text-lax-danger-fg",
          "in-data-[lax-density=client]:gap-3 in-data-[lax-density=client]:border-transparent in-data-[lax-density=client]:p-4",
          className,
        )}
      >
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        <div className="min-w-0">
          <p id={titleId} className="font-medium in-data-[lax-density=client]:font-semibold">
            {title}
          </p>
          <ul className="mt-1 flex flex-col">
            {errors.map((error) => (
              <li key={error.fieldId}>
                <a
                  href={`#${error.fieldId}`}
                  onClick={(event) => {
                    if (focusControl(error.fieldId)) event.preventDefault();
                  }}
                  className="lax-focus inline-block rounded-lax-badge font-medium underline decoration-1 underline-offset-4 hover:decoration-2"
                >
                  {error.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  },
);
