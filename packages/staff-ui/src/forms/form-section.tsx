"use client";

import { CircleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";

/**
 * A group of related fields with its title and purpose on the left (from `lg`) and the fields on
 * the right, Stripe-settings style. Stacks on narrower screens. Sections are separated by a
 * hairline, not boxed, so long forms stay calm.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = React.useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "grid min-w-0 gap-4 border-b border-staff-line-subtle pb-6 last:border-b-0 last:pb-0 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="font-staff text-staff-md font-semibold text-staff-fg">
          {title}
        </h2>
        {description ? <p className="text-staff-sm text-staff-muted">{description}</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/** Two fields side by side from `sm`, e.g. carrier and tracking number. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

/**
 * The form's actions: primary last (right), aligned to the fields. `sticky` keeps them in view at
 * the foot of the window on long forms, on the page surface with a hairline above. `start` holds
 * what sits apart on the left (Cancel, a save status).
 */
export function FormActions({
  children,
  start,
  sticky = false,
  className,
}: {
  children: React.ReactNode;
  start?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        start ? "justify-between" : "justify-end",
        sticky &&
          "sticky bottom-0 z-10 -mx-4 border-t border-staff-line bg-staff-canvas px-4 py-3 sm:-mx-6 sm:px-6",
        className,
      )}
    >
      {start ? <div className="flex flex-wrap items-center gap-2">{start}</div> : null}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Moves focus to a field and scrolls its label into view, so the question shows with it. */
function focusField(fieldId: string) {
  const field = document.getElementById(fieldId);
  if (!field) return false;
  const label = [...document.querySelectorAll("label")].find((item) => item.htmlFor === fieldId);
  field.focus({ preventScroll: true });
  (label ?? field).scrollIntoView?.({ block: "start" });
  return document.activeElement === field;
}

export type FormErrorSummaryProps = {
  errors: ReadonlyArray<{ fieldId: string; message: string }>;
  title?: string;
  /**
   * Changes once per failed submit (e.g. a submit counter). Without it, focus moves to the
   * summary whenever it appears. With it, focus moves only when the key changes, so errors that
   * come and go while the person fixes fields never pull focus away. Keep the summary mounted
   * (it renders nothing without errors) so it remembers the last key.
   */
  focusKey?: string | number;
};

/**
 * What to fix after a failed submit, at the top of the form. It takes focus when it appears (and
 * on each failed submit, with `focusKey`), so keyboard and screen reader users land on it; each
 * error links to its field and moves focus there. Messages match the inline errors exactly.
 */
export const FormErrorSummary = React.forwardRef<HTMLDivElement, FormErrorSummaryProps>(
  function FormErrorSummary({ errors, title = "There is a problem", focusKey }, forwardedRef) {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const focusedFor = React.useRef<unknown>(Symbol("never focused"));
    const titleId = React.useId();
    const visible = errors.length > 0;

    React.useImperativeHandle(forwardedRef, () => ref.current as HTMLDivElement);

    React.useEffect(() => {
      if (!visible) return;
      // Without a key, focus follows the summary appearing; with one, it follows each submit.
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
        className="staff-focus flex gap-2.5 rounded-staff-lg border border-staff-danger/30 bg-staff-danger-bg px-3 py-2.5 text-staff-sm text-staff-danger-fg"
      >
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div>
          <p id={titleId} className="font-semibold">
            {title}
          </p>
          <ul className="mt-1 list-disc pl-4">
            {errors.map((error) => (
              <li key={error.fieldId}>
                <a
                  href={`#${error.fieldId}`}
                  onClick={(event) => {
                    if (focusField(error.fieldId)) event.preventDefault();
                  }}
                  className="staff-focus inline-block rounded-staff-xs font-medium leading-6 underline underline-offset-2 hover:decoration-2"
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

/**
 * Irreversible or account-level actions, kept apart at the foot of a record page: a red-ruled
 * card, each action a row with what it does on the left and its button on the right.
 */
export function DangerZone({
  title = "Danger zone",
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn("rounded-staff-lg border border-staff-danger/35 bg-staff-surface", className)}
    >
      <h2 className="border-b border-staff-danger/20 px-4 py-3 font-staff text-staff-md font-semibold text-staff-danger">
        {title}
      </h2>
      <div className="divide-y divide-staff-line-subtle">{children}</div>
    </section>
  );
}

export function DangerZoneAction({
  title,
  description,
  action,
}: {
  title: string;
  description: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-staff-sm font-medium text-staff-fg">{title}</p>
        <p className="text-staff-sm text-staff-muted">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
