"use client";

import { Checkbox } from "@auction/ui/components/checkbox";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import { Switch, useReadOnlyView } from "@auction/ui/lax";
import { Check, Lock } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";

/*
 * Checkbox, radio and switch: the shared Radix-backed primitives from @auction/ui, drawn at the
 * staff scale. 16px boxes (radius xs), ink when on, the control border (3:1 on any surface) when
 * off, and the same focus ring as every other control. Each sits in a 32px row with its label so
 * the hit area is generous.
 *
 * The box is drawn at 16px but answers a 24px square (CRF-6, WCAG 2.5.8): an invisible layer 4px
 * past each edge takes the press, so a box with no label beside it (a table cell, a confirm row
 * whose label wraps) is still easy to hit.
 */

/** The 24px hit area around a 16px box: an unpainted layer 4px past each edge. */
export const CHOICE_HIT_AREA = "relative before:absolute before:-inset-1";

const boxBase = [
  "size-4 shrink-0 border border-staff-control-border bg-staff-surface shadow-none",
  CHOICE_HIT_AREA,
  "hover:border-staff-control-border-hover",
  // The wrapped primitive turns the outline off on focus; turn the staff ring back on explicitly.
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-staff-focus",
  "focus-visible:ring-0 focus-visible:ring-offset-0",
  "disabled:cursor-not-allowed disabled:border-staff-line disabled:bg-staff-sunken disabled:opacity-100",
  "aria-invalid:border-staff-danger",
].join(" ");

export function StaffCheckbox({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Checkbox>) {
  if (useReadOnlyView()) {
    const on = props.checked === true;
    return (
      <span
        id={props.id}
        role="img"
        aria-label={on ? "Yes" : "No"}
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-staff-xs border",
          on
            ? "border-staff-ink bg-staff-ink text-staff-on-ink"
            : "border-staff-line-strong bg-transparent",
          className,
        )}
      >
        {on ? <Check aria-hidden className="size-3 stroke-[2.5]" /> : null}
      </span>
    );
  }
  return (
    <Checkbox
      className={cn(
        boxBase,
        "rounded-staff-xs text-staff-on-ink",
        "data-[state=checked]:border-staff-ink data-[state=checked]:bg-staff-ink data-[state=checked]:text-staff-on-ink",
        "data-[state=indeterminate]:border-staff-ink data-[state=indeterminate]:bg-staff-ink",
        "disabled:data-[state=checked]:border-staff-line-strong disabled:data-[state=checked]:bg-staff-line-strong",
        "[&_svg]:size-3 [&_svg]:stroke-[2.5]",
        className,
      )}
      {...props}
    />
  );
}

export function StaffRadioGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadioGroup>) {
  return <RadioGroup className={cn("grid gap-1", className)} {...props} />;
}

export function StaffRadio({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadioGroupItem>) {
  return (
    <RadioGroupItem
      className={cn(
        boxBase,
        "rounded-full text-staff-ink",
        // A disabled choice keeps the control border (3:1), so a fixed set of options (a
        // published sale's premium) still reads as a set; the sunken fill and the dimmed label
        // say it cannot change.
        "disabled:border-staff-control-border",
        "data-[state=checked]:border-staff-ink",
        "focus-visible:border-staff-ink focus-visible:ring-0",
        className,
      )}
      indicatorClassName="size-2 fill-staff-ink stroke-none"
      {...props}
    />
  );
}

export type StaffSwitchProps = React.ComponentPropsWithoutRef<typeof Switch> & {
  /**
   * Blocked by the record's state (PRM-2): the switch keeps focus, is `aria-disabled`, drawn
   * disabled, and a press changes nothing. Point `aria-describedby` at the visible reason (a
   * `ChoiceRow` with the same `disabledReason` draws it as `choiceReasonId(htmlFor)`).
   */
  disabledReason?: string;
};

/**
 * The LAX system switch (`@auction/ui/lax`): 32×20 at the staff density. With `disabledReason`
 * it stays focusable and inert, unlike native `disabled`, so keyboard and screen-reader users
 * reach the reason.
 */
export function StaffSwitch({ disabledReason, className, ...props }: StaffSwitchProps) {
  if (!disabledReason) return <Switch className={className} {...props} />;
  const { onCheckedChange: _ignored, disabled: _disabled, ...rest } = props;
  return (
    <Switch
      {...rest}
      aria-disabled
      onClick={(event) => event.preventDefault()}
      className={cn(
        "cursor-not-allowed",
        "data-[state=checked]:bg-lax-line-hover data-[state=unchecked]:bg-lax-line",
        "hover:data-[state=checked]:bg-lax-line-hover hover:data-[state=unchecked]:bg-lax-line",
        "data-[state=unchecked]:[&>span]:bg-lax-disabled-fg",
        className,
      )}
    />
  );
}

/** The id of a `ChoiceRow`'s disabled reason, for its control's `aria-describedby`. */
export const choiceReasonId = (htmlFor: string): string => `${htmlFor}-reason`;

/**
 * Why a control or setting cannot change now (PRM-2), on its own line after a lock: under a
 * `ChoiceRow`'s text, or under a read-only setting so both views say it the same way.
 */
export function DisabledReason({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      {...(id ? { id } : {})}
      className={cn("flex items-start gap-1.5 text-staff-xs font-medium text-staff-fg", className)}
    >
      <Lock aria-hidden className="mt-0.5 size-3 shrink-0 text-staff-muted" />
      <span>{children}</span>
    </span>
  );
}

/**
 * A checkbox, radio or switch with its label in one 32px row, label clickable. `disabledReason`
 * says on its own line, after a lock, why the control cannot change now (PRM-2); give the control
 * the same reason and `aria-describedby={choiceReasonId(htmlFor)}`.
 */
export function ChoiceRow({
  control,
  label,
  description,
  htmlFor,
  disabled = false,
  disabledReason,
  className,
}: {
  control: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const blocked = disabled || Boolean(disabledReason);
  return (
    <div className={cn("flex min-h-control-sm items-start gap-2.5 py-1.5", className)}>
      <span className="flex h-5 items-center">{control}</span>
      <span className="flex min-w-0 max-w-prose flex-col gap-1">
        <label
          htmlFor={htmlFor}
          className={cn(
            "flex flex-col text-staff-sm text-staff-fg",
            blocked ? "cursor-not-allowed" : "cursor-pointer",
            disabled && "text-staff-disabled",
          )}
        >
          <span className="font-medium">{label}</span>
          {description ? (
            <span className="text-staff-xs text-staff-muted">{description}</span>
          ) : null}
        </label>
        {disabledReason ? (
          <DisabledReason id={choiceReasonId(htmlFor)}>{disabledReason}</DisabledReason>
        ) : null}
      </span>
    </div>
  );
}
