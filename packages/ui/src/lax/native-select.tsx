"use client";

import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/utils.js";
import { useField } from "./field.js";
import { fieldBox } from "./styles.js";

export type NativeSelectOption<T extends string> = { value: T; label: string };

export type NativeSelectProps<T extends string> = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange" | "children"
> & {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly NativeSelectOption<T>[];
};

/**
 * A choose-one field with the platform's own picker: a wheel on a phone, a list on a computer.
 * It sits in the shared field box, so it lines up with text inputs, and reads its label, hint
 * and error from the surrounding `Field`. Use it for filters and short lists; a long list with
 * search wants a picker.
 */
export function NativeSelect<T extends string>({
  value,
  onValueChange,
  options,
  id,
  disabled,
  className,
  ...props
}: NativeSelectProps<T>) {
  const field = useField();
  const describedBy = props["aria-describedby"] ?? field?.describedBy;
  return (
    <div className={cn(fieldBox, "relative h-lax-control-md px-0 text-lax-14", className)}>
      <select
        id={id ?? field?.controlId}
        disabled={disabled ?? field?.disabled}
        aria-invalid={field?.invalid || undefined}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        {...props}
        value={value}
        onChange={(event) => {
          const match = options.find((option) => option.value === event.target.value);
          if (match) onValueChange(match.value);
        }}
        className="h-full w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-9 pl-3 outline-none disabled:cursor-not-allowed"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3" />
    </div>
  );
}
