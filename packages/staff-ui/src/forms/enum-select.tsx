"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { fieldBox, readOnlyBox, useField } from "@auction/ui/lax";
import * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";

export type EnumOption<T extends string> = {
  value: T;
  label: string;
  /** One line under the label, e.g. what choosing it does. */
  description?: string;
  disabled?: boolean;
};

export type EnumSelectProps<T extends string> = {
  value: T | null;
  onValueChange: (value: T) => void;
  options: readonly EnumOption<T>[];
  placeholder?: string;
  /** `live` is 44px at every pointer, for fields filled under time pressure. */
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
};

/**
 * A closed list of values, shown by label. Used wherever a form used to take a typed enum: only
 * the options passed in can be chosen, so callers pass just the valid next states.
 */
export function EnumSelect<T extends string>({
  value,
  onValueChange,
  options,
  placeholder = "Choose…",
  size = "md",
  disabled,
  invalid,
  id,
  className,
  ...aria
}: EnumSelectProps<T>) {
  const field = useField();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const byValue = React.useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  if (field?.readOnly) {
    const chosen = value ? byValue.get(value)?.label : undefined;
    return (
      <div
        data-readonly=""
        id={id ?? field.controlId}
        // biome-ignore lint/a11y/useSemanticElements: a read-only value, not an editable input
        role="textbox"
        aria-readonly="true"
        tabIndex={0}
        aria-labelledby={field.labelId}
        {...(field.describedBy ? { "aria-describedby": field.describedBy } : {})}
        className={cn(
          fieldBox,
          readOnlyBox,
          size === "sm" && "h-control-sm text-staff-sm",
          size === "md" && "h-control-md text-staff-md",
          size === "lg" && "h-11 text-staff-md",
          className,
        )}
      >
        <span className="truncate">{chosen ?? ""}</span>
      </div>
    );
  }

  return (
    <Select
      {...(value ? { value } : { value: "" })}
      onValueChange={(next) => {
        const option = byValue.get(next as T);
        if (option) onValueChange(option.value);
      }}
      disabled={disabled ?? field?.disabled ?? false}
    >
      <SelectTrigger
        id={id ?? field?.controlId}
        aria-invalid={isInvalid || undefined}
        {...(field?.describedBy ? { "aria-describedby": field.describedBy } : {})}
        {...(aria["aria-label"] ? { "aria-label": aria["aria-label"] } : {})}
        className={cn(
          fieldBox,
          "justify-between shadow-none",
          size === "sm" && "h-control-sm text-staff-sm",
          size === "md" && "h-control-md text-staff-md",
          size === "lg" && "h-11 text-staff-md",
          "staff-focus focus:ring-0 focus:ring-offset-0",
          "aria-invalid:border-staff-danger",
          "disabled:cursor-not-allowed disabled:border-staff-line disabled:bg-staff-sunken disabled:text-staff-disabled disabled:opacity-100",
          "data-[placeholder]:text-staff-subtle data-[state=open]:border-staff-control-border-hover",
          "[&>svg]:opacity-100 [&_[data-option-hint]]:hidden",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        {...STAFF_LAYER}
        className="rounded-staff-md border-staff-line bg-staff-raised p-0 text-staff-fg shadow-staff-md"
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            {...(option.disabled ? { disabled: true } : {})}
            className={cn(
              "min-h-control-sm rounded-staff-sm py-1.5 pr-8 pl-2.5 font-staff text-staff-sm text-staff-fg",
              "focus:bg-staff-hover focus:text-staff-fg data-[state=checked]:font-medium",
              "data-[disabled]:text-staff-disabled data-[disabled]:opacity-100",
              "[&_svg]:size-4",
            )}
          >
            {option.description ? (
              <span className="flex flex-col">
                <span>{option.label}</span>
                <span data-option-hint className="text-staff-xs font-normal text-staff-muted">
                  {option.description}
                </span>
              </span>
            ) : (
              option.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
