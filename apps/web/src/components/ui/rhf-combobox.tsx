"use client";

import { Combobox, type ComboboxOption, type ComboboxProps } from "@auction/ui/components/combobox";
import { useFormField } from "@auction/ui/components/form";

type Props = Omit<ComboboxProps, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
};

/** Searchable select wired for react-hook-form `FormField` + `FormItem`. */
export function RhfCombobox({ value, onChange, onBlur, options, ...rest }: Props) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  const describedBy =
    error && formMessageId ? `${formDescriptionId} ${formMessageId}`.trim() : formDescriptionId;

  return (
    <Combobox
      id={formItemId}
      aria-invalid={!!error}
      aria-describedby={describedBy}
      value={value}
      onChange={onChange}
      {...(onBlur ? { onBlur } : {})}
      options={options}
      {...rest}
    />
  );
}
