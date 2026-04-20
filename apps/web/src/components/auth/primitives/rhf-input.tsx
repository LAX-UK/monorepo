"use client";

import { optionalString } from "@/lib/ts/if-defined";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import { FloatingUnderlineInput } from "./floating-underline-input";

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
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FloatingUnderlineInput
          {...field}
          label={label}
          type={type}
          autoComplete={autoComplete}
          {...optionalString("error", fieldState.error?.message)}
        />
      )}
    />
  );
}
