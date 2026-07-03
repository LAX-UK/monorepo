"use client";

import { type Ref, useId } from "react";
import { cn } from "../../lib/utils.js";
import { Label } from "./label.js";
import { RadioGroup, RadioGroupItem } from "./radio-group.js";

export type RadioCardOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type RadioCardGroupProps = {
  legend: string;
  hideLegend?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly RadioCardOption[];
  error?: string;
  className?: string;
  optionClassName?: string;
  /** Passed to the first option's radio for RHF ref forwarding. */
  inputRef?: Ref<HTMLButtonElement>;
};

/** Accessible card-style single-select built on {@link RadioGroup}. */
export function RadioCardGroup({
  legend,
  hideLegend = false,
  value,
  onValueChange,
  options,
  error,
  className,
  optionClassName,
  inputRef,
}: RadioCardGroupProps) {
  const groupId = useId();
  const errorId = `${groupId}-error`;

  return (
    <fieldset
      aria-labelledby={groupId}
      aria-describedby={error ? errorId : undefined}
      className={className}
    >
      <legend
        id={groupId}
        className={hideLegend ? "sr-only" : "mb-3 font-label text-sm font-medium text-on-surface"}
      >
        {legend}
      </legend>
      <RadioGroup value={value} onValueChange={onValueChange} className="flex flex-col gap-3">
        {options.map((option, index) => {
          const id = `${groupId}-${option.value}`;
          return (
            <Label
              key={option.value}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border border-outline-variant/40 p-4 transition-colors hover:bg-surface-container-low/60 has-[:checked]:border-primary has-[:checked]:bg-primary/5",
                option.disabled && "cursor-not-allowed opacity-50",
                optionClassName,
              )}
            >
              <RadioGroupItem
                id={id}
                value={option.value}
                className="mt-0.5"
                disabled={option.disabled}
                ref={index === 0 ? inputRef : undefined}
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-body text-sm font-medium text-on-surface">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="font-body text-xs text-on-surface-variant">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </Label>
          );
        })}
      </RadioGroup>
      {error ? (
        <p id={errorId} className="mt-2 font-footer-links text-xs text-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
