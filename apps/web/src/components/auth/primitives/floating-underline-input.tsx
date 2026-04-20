"use client";

import { optionalString } from "@/lib/ts/if-defined";
import { cn } from "@auction/ui";
import { type InputHTMLAttributes, type ReactNode, forwardRef, useId, useState } from "react";
import { FieldError } from "./form-error";

export type FloatingUnderlineInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  /** Classes for the bordered underline container (below the floating label). */
  containerClassName?: string;
  inputClassName?: string;
  endAdornment?: ReactNode;
};

export const FloatingUnderlineInput = forwardRef<HTMLInputElement, FloatingUnderlineInputProps>(
  function FloatingUnderlineInput(
    {
      label,
      error,
      className = "",
      containerClassName = "",
      inputClassName = "",
      id,
      value,
      endAdornment,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) {
    const genId = useId();
    const inputId = id ?? genId;
    const strVal = value === undefined || value === null ? "" : String(value);
    const [focused, setFocused] = useState(false);
    const float = focused || strVal.length > 0;

    return (
      <div className={cn("w-full", className)}>
        <div
          className={cn(
            "relative rounded-t border-b border-brand-300 pt-5 pb-2 transition-colors",
            error ? "border-error" : focused ? "border-brand-900" : "",
            containerClassName,
          )}
        >
          <label
            htmlFor={inputId}
            className={cn(
              "pointer-events-none absolute left-0 font-footer-links text-brand-400 transition-all duration-150",
              float
                ? "top-0 text-xs leading-[18px] tracking-[0.16px]"
                : "top-4 text-base leading-6 tracking-[0.5px]",
            )}
          >
            {label}
          </label>
          <input
            ref={ref}
            id={inputId}
            value={value}
            {...rest}
            className={cn(
              "w-full border-0 bg-transparent pb-1 font-footer-links text-base leading-6 tracking-[0.5px] text-brand-900 outline-none placeholder:text-transparent",
              endAdornment ? "pr-10" : "",
              inputClassName,
            )}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
          />
          {endAdornment ? (
            <div className="pointer-events-auto absolute right-0 bottom-2 flex items-center">
              {endAdornment}
            </div>
          ) : null}
        </div>
        <FieldError {...optionalString("message", error)} />
      </div>
    );
  },
);
