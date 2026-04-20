"use client";

import { optionalString } from "@/lib/ts/if-defined";
import { PasswordInput } from "@auction/ui";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";

type RHFPasswordFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  autoComplete?: string;
};

export function RHFPasswordField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  autoComplete = "current-password",
}: RHFPasswordFieldProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <PasswordInput
          {...field}
          label={label}
          autoComplete={autoComplete}
          {...optionalString("error", fieldState.error?.message)}
        />
      )}
    />
  );
}
