"use client";

import { Checkbox } from "@auction/ui/components/checkbox";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import { Switch, useReadOnlyView } from "@auction/ui/lax";
import { Check } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";

/*
 * Checkbox, radio and switch: the shared Radix-backed primitives from @auction/ui, drawn at the
 * staff scale. 16px boxes (radius xs), ink when on, the control border (3:1 on any surface) when
 * off, and the same focus ring as every other control. Each sits in a 32px row with its label so
 * the hit area is generous.
 */

const boxBase = [
  "size-4 shrink-0 border border-staff-control-border bg-staff-surface shadow-none",
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
        "data-[state=checked]:border-staff-ink",
        "focus-visible:border-staff-ink focus-visible:ring-0",
        className,
      )}
      indicatorClassName="size-2 fill-staff-ink stroke-none"
      {...props}
    />
  );
}

/** The LAX system switch (`@auction/ui/lax`): 32×20 at the staff density. */
export const StaffSwitch = Switch;

/** A checkbox, radio or switch with its label in one 32px row, label clickable. */
export function ChoiceRow({
  control,
  label,
  description,
  htmlFor,
  disabled = false,
  className,
}: {
  control: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-control-sm items-start gap-2.5 py-1.5", className)}>
      <span className="flex h-5 items-center">{control}</span>
      <label
        htmlFor={htmlFor}
        className={cn(
          "flex flex-col text-staff-sm text-staff-fg",
          disabled ? "cursor-not-allowed text-staff-disabled" : "cursor-pointer",
        )}
      >
        <span className="font-medium">{label}</span>
        {description ? <span className="text-staff-xs text-staff-muted">{description}</span> : null}
      </label>
    </div>
  );
}
