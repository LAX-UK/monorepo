"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import { FieldError } from "./form-error";

type RHFCheckboxFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  children: ReactNode;
};

export function RHFCheckboxField<TFieldValues extends FieldValues>({
  control,
  name,
  children,
}: RHFCheckboxFieldProps<TFieldValues>) {
  const checkboxId = useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="w-full">
          <div className="flex flex-row items-start gap-2">
            <input
              id={checkboxId}
              type="checkbox"
              checked={Boolean(field.value)}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              ref={field.ref}
              className="mt-0.5 size-6 shrink-0 cursor-pointer rounded-sm border-[1.5px] border-brand-900 accent-brand-900"
            />
            <label
              htmlFor={checkboxId}
              className="cursor-pointer font-footer-links text-sm leading-[18px] tracking-[0.16px] text-[#161616]"
            >
              {children}
            </label>
          </div>
          <FieldError
            {...(fieldState.error?.message ? { message: fieldState.error.message } : {})}
          />
        </div>
      )}
    />
  );
}
