"use client";

import { optionalString } from "@/lib/ts/if-defined";
import { FloatingLabelInput } from "@auction/ui";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";

type RHFInputProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  type?: string;
  autoComplete?: string;
};

export function RHFInput<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  type = "text",
  autoComplete,
}: RHFInputProps<TFieldValues>) {
  const inputMode =
    type === "email" ? "email" : type === "tel" ? "tel" : type === "number" ? "decimal" : undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FloatingLabelInput
          {...field}
          label={label}
          type={type}
          autoComplete={autoComplete}
          {...(inputMode ? { inputMode } : {})}
          {...optionalString("error", fieldState.error?.message)}
        />
      )}
    />
  );
}
