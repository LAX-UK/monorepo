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

/** The form's actions: primary last (right), aligned to the fields. */
export function FormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>{children}</div>
  );
}

/**
 * Summary of what to fix after a failed submit, linking to each field. Shown above the form and
 * focused, so keyboard and screen reader users land on it.
 */
export function FormErrorSummary({
  errors,
  title = "Check the highlighted fields",
}: {
  errors: ReadonlyArray<{ fieldId: string; message: string }>;
  title?: string;
}) {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-staff-md border border-staff-danger/30 bg-staff-danger-bg px-3 py-2.5 text-staff-sm text-staff-danger-fg"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">{title}</p>
        <ul className="mt-1 list-disc pl-4">
          {errors.map((error) => (
            <li key={error.fieldId}>
              <a href={`#${error.fieldId}`} className="underline underline-offset-2">
                {error.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

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
      className={cn("rounded-staff-md border border-staff-danger/35 bg-staff-surface", className)}
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
