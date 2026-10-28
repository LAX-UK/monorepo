"use client";

import { applicationFieldId } from "@/lib/artist-application/artist-application-form";
import { MarketingFormField } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import { Textarea } from "@auction/ui/components/textarea";
import type { ComponentProps, ReactNode } from "react";

type Common = {
  /** The field's key in the form's errors, e.g. `artistName` or `works.2.title`. */
  field: string;
  label: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  error: string | undefined;
  className?: string;
};

/** A one-line answer on the lax.art underline field, with its label, hint and error. */
export function ApplicationTextField({
  field,
  label,
  hint,
  optional,
  error,
  className,
  ...input
}: Common & Omit<ComponentProps<typeof Input>, "id" | "variant">) {
  return (
    <MarketingFormField
      id={applicationFieldId(field)}
      label={label}
      hint={hint}
      error={error ?? null}
      {...(optional ? { optional } : {})}
      {...(className ? { className } : {})}
    >
      {(control) => <Input {...control} {...input} variant="underline" className="min-h-11" />}
    </MarketingFormField>
  );
}

/**
 * A longer answer, with how much of the allowance is used shown under it once the artist is
 * near the end, so the limit never comes as a surprise.
 */
export function ApplicationTextArea({
  field,
  label,
  hint,
  optional,
  error,
  className,
  value,
  maxLength,
  rows = 5,
  ...textarea
}: Common &
  Omit<ComponentProps<typeof Textarea>, "id" | "variant" | "value" | "maxLength"> & {
    value: string;
    maxLength: number;
  }) {
  const used = value.length;
  const near = used >= maxLength * 0.8;
  return (
    <MarketingFormField
      id={applicationFieldId(field)}
      label={label}
      hint={hint}
      error={error ?? null}
      {...(optional ? { optional } : {})}
      {...(className ? { className } : {})}
    >
      {(control) => (
        <div className="flex flex-col gap-1.5">
          <Textarea
            {...control}
            {...textarea}
            value={value}
            maxLength={maxLength}
            rows={rows}
            variant="underline"
            className="min-h-28 leading-relaxed"
          />
          <p
            className={cn(
              "m-0 self-end font-label text-xs tabular-nums",
              near ? "text-on-surface" : "text-on-surface-variant",
            )}
            aria-live={near ? "polite" : "off"}
          >
            {used.toLocaleString("en-GB")} of {maxLength.toLocaleString("en-GB")} characters
          </p>
        </div>
      )}
    </MarketingFormField>
  );
}

/** The step's heading and what it asks for, at the top of each step. */
export function ApplicationStepHeading({
  id,
  title,
  intro,
}: {
  id: string;
  title: string;
  intro: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2
        id={id}
        tabIndex={-1}
        className="m-0 font-headline text-2xl font-medium leading-tight text-on-surface outline-none md:text-3xl"
      >
        {title}
      </h2>
      <p className="m-0 max-w-[60ch] text-base leading-relaxed text-on-surface-variant">{intro}</p>
    </div>
  );
}
