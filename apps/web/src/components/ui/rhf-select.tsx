"use client";

import { FormControl } from "@auction/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";

export type RhfSelectOption = { value: string; label: string };

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  options: RhfSelectOption[];
  triggerClassName?: string;
};

/** Radix Select wired for react-hook-form `FormField` + `FormItem`. Includes `FormControl` around the trigger. */
export function RhfSelect({
  value,
  onValueChange,
  onBlur,
  disabled = false,
  placeholder,
  options,
  triggerClassName,
}: Props) {
  return (
    <Select
      disabled={disabled}
      onValueChange={onValueChange}
      {...(value.length > 0 ? { value } : {})}
    >
      <FormControl>
        <SelectTrigger className={triggerClassName} onBlur={onBlur}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
