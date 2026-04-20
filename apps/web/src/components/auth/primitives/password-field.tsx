"use client";

import { useState } from "react";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import { FloatingUnderlineInput } from "./floating-underline-input";

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
  const [visible, setVisible] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FloatingUnderlineInput
          {...field}
          label={label}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
          endAdornment={
            <button
              type="button"
              className="font-footer-links text-xs font-medium text-brand-400 underline decoration-brand-400 underline-offset-2"
              onClick={() => setVisible((v) => !v)}
              aria-pressed={visible}
              tabIndex={-1}
            >
              {visible ? "Hide" : "Show"}
            </button>
          }
        />
      )}
    />
  );
}
