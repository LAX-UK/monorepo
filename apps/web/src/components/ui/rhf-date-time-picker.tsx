"use client";

import { DateTimePicker, type DateTimePickerProps } from "@auction/ui/components/date-time-picker";
import { useFormField } from "@auction/ui/components/form";

type Props = Omit<DateTimePickerProps, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export function RhfDateTimePicker({ value, onChange, onBlur, ...rest }: Props) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  const describedBy =
    error && formMessageId ? `${formDescriptionId} ${formMessageId}`.trim() : formDescriptionId;

  return (
    <DateTimePicker
      id={formItemId}
      aria-invalid={!!error}
      aria-describedby={describedBy}
      value={value}
      onChange={onChange}
      {...(onBlur ? { onBlur } : {})}
      {...rest}
    />
  );
}
