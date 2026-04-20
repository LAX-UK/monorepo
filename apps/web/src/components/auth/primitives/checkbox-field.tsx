"use client";

import { optionalString } from "@/lib/ts/if-defined";
import { Checkbox } from "@auction/ui/components/checkbox";
import { Label } from "@auction/ui/components/label";
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
            <Checkbox
              id={checkboxId}
              checked={Boolean(field.value)}
              onCheckedChange={(v) => field.onChange(v === true)}
              onBlur={field.onBlur}
              ref={field.ref}
              className="mt-0.5 size-6 shrink-0 cursor-pointer rounded-sm border-[1.5px] border-brand-900 data-[state=checked]:bg-brand-900 data-[state=checked]:text-[#F1F1F3]"
            />
            <Label
              htmlFor={checkboxId}
              className="cursor-pointer font-footer-links text-sm leading-[18px] tracking-[0.16px] font-normal text-[#161616]"
            >
              {children}
            </Label>
          </div>
          <FieldError {...optionalString("message", fieldState.error?.message)} />
        </div>
      )}
    />
  );
}
