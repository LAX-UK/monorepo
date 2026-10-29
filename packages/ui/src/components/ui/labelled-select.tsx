"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";
import { Label } from "./label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";

export type SelectOption<T extends string = string> = {
  value: T;
  /** The words a person reads ("Buyer agent"), never the stored value. */
  label: string;
  disabled?: boolean;
};

/**
 * Every select must have an accessible name, and the type requires exactly one source for it:
 * a `label` (shown above the field, or kept for screen readers only with `hideLabel`), an
 * `aria-label` ("Role for Lena Fischer") for a compact picker inside a row, or `aria-labelledby`
 * pointing at text already on the page.
 */
export type SelectAccessibleName =
  | { label: string; hideLabel?: boolean; "aria-label"?: never; "aria-labelledby"?: never }
  | { "aria-label": string; label?: never; hideLabel?: never; "aria-labelledby"?: never }
  | { "aria-labelledby": string; label?: never; hideLabel?: never; "aria-label"?: never };

export type LabelledSelectProps<T extends string = string> = SelectAccessibleName & {
  options: readonly SelectOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  /** Shown while nothing is chosen. Never a substitute for the label. */
  placeholder?: string;
  /** One line under the label that helps a person choose. */
  hint?: string;
  /** What is wrong with the choice; marks the field invalid and is read with it. */
  error?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
};

/**
 * A select with its name, hint and error wired together: the label names the trigger, the hint
 * and error describe it, and only the options a caller passes are offered.
 */
export function LabelledSelect<T extends string = string>(props: LabelledSelectProps<T>) {
  const {
    options,
    value,
    defaultValue,
    onValueChange,
    placeholder,
    hint,
    error,
    name,
    id,
    disabled,
    required,
    className,
    triggerClassName,
  } = props;
  const generatedId = React.useId();
  const triggerId = id ?? generatedId;
  const hintId = hint ? `${triggerId}-hint` : undefined;
  const errorId = error ? `${triggerId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const label = "label" in props ? props.label : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={triggerId} className={cn("leading-5", props.hideLabel && "sr-only")}>
          {label}
        </Label>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-[0.8125rem] leading-5 text-on-surface-variant">
          {hint}
        </p>
      ) : null}
      <Select
        {...(value !== undefined ? { value } : {})}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        {...(onValueChange ? { onValueChange: (next: string) => onValueChange(next as T) } : {})}
        {...(name ? { name } : {})}
        {...(disabled ? { disabled } : {})}
        {...(required ? { required } : {})}
      >
        <SelectTrigger
          id={triggerId}
          className={cn(error && "border-error", triggerClassName)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...("aria-label" in props && props["aria-label"]
            ? { "aria-label": props["aria-label"] }
            : {})}
          {...("aria-labelledby" in props && props["aria-labelledby"]
            ? { "aria-labelledby": props["aria-labelledby"] }
            : {})}
        >
          <SelectValue {...(placeholder ? { placeholder } : {})} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              {...(option.disabled ? { disabled: true } : {})}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p id={errorId} className="text-[0.8125rem] leading-5 text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
