"use client";

import { type InputHTMLAttributes, type ReactNode, forwardRef, useId, useState } from "react";
import { FieldError } from "./form-error";

export type FloatingUnderlineInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
> & {
  label: string;
  error?: string;
  className?: string;
  inputClassName?: string;
  endAdornment?: ReactNode;
};

export const FloatingUnderlineInput = forwardRef<HTMLInputElement, FloatingUnderlineInputProps>(
  function FloatingUnderlineInput(
    {
      label,
      error,
      className = "",
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
      <div className={`w-full ${className}`}>
        <div
          className={`relative rounded-t border-b border-brand-300 pt-5 pb-2 transition-colors ${
            error ? "border-error" : focused ? "border-brand-900" : ""
          }`}
        >
          <label
            htmlFor={inputId}
            className={`pointer-events-none absolute left-0 font-footer-links text-brand-400 transition-all duration-150 ${
              float
                ? "top-0 text-xs leading-[18px] tracking-[0.16px]"
                : "top-4 text-base leading-6 tracking-[0.5px]"
            }`}
          >
            {label}
          </label>
          <input
            ref={ref}
            id={inputId}
            value={value}
            {...rest}
            className={`w-full border-0 bg-transparent pb-1 font-footer-links text-base leading-6 tracking-[0.5px] text-brand-900 outline-none placeholder:text-transparent ${endAdornment ? "pr-10" : ""} ${inputClassName}`}
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
        <FieldError {...(error ? { message: error } : {})} />
      </div>
    );
  },
);
