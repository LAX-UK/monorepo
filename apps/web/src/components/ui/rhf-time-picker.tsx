"use client";

import { useFormField } from "@auction/ui/components/form";
import { TimePicker, type TimePickerProps } from "@auction/ui/components/time-picker";

type Props = Omit<TimePickerProps, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export function RhfTimePicker({ value, onChange, onBlur, ...rest }: Props) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  const describedBy =
    error && formMessageId ? `${formDescriptionId} ${formMessageId}`.trim() : formDescriptionId;

  return (
    <TimePicker
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
