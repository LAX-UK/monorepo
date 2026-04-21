"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

export type FloatingLabelInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  /** Space-separated ids for `aria-describedby` (e.g. hint + live region), merged after error id when present */
  ariaDescribedByExtra?: string;
  containerClassName?: string;
  inputClassName?: string;
  endAdornment?: React.ReactNode;
};

export const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  function FloatingLabelInput(
    {
      label,
      error,
      ariaDescribedByExtra,
      className = "",
      containerClassName = "",
      inputClassName = "",
      id,
      value,
      endAdornment,
      onFocus,
      onBlur,
      disabled,
      ...rest
    },
    ref,
  ) {
    const { "aria-describedby": userDescribedBy, ...restInput } = rest;
    const genId = React.useId();
    const inputId = id ?? genId;
    const errorId = error ? `${inputId}-error` : undefined;
    const extraIds = ariaDescribedByExtra?.trim().split(/\s+/).filter(Boolean) ?? [];
    const describedByIds = [...(errorId ? [errorId] : []), ...extraIds];
    const merged =
      [...describedByIds, ...(userDescribedBy ? String(userDescribedBy).split(/\s+/) : [])].filter(
        Boolean,
      );
    const ariaDescribedByMerged = merged.length > 0 ? merged.join(" ") : undefined;
    const strVal = value === undefined || value === null ? "" : String(value);
    const [focused, setFocused] = React.useState(false);
    const float = focused || strVal.length > 0;

    return (
      <div className={cn("w-full", className)}>
        <div
          className={cn(
            "relative rounded-t border-b border-input-border bg-transparent pt-5 pb-2 transition-colors",
            error ? "border-error" : focused ? "border-input-border-focus" : "",
            disabled ? "opacity-60" : "",
            containerClassName,
          )}
        >
          <label
            htmlFor={inputId}
            className={cn(
              "pointer-events-none absolute left-0 font-footer-links text-on-surface-variant transition-all duration-150",
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
            disabled={disabled}
            {...(error ? { "aria-invalid": true as const } : {})}
            {...(ariaDescribedByMerged ? { "aria-describedby": ariaDescribedByMerged } : {})}
            {...restInput}
            className={cn(
              "w-full border-0 bg-transparent pb-1 font-footer-links text-base leading-6 tracking-[0.5px] text-on-surface outline-none placeholder:text-transparent focus-visible:outline-none disabled:cursor-not-allowed",
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
        {error ? (
          <p id={errorId} role="alert" className="mt-1 font-footer-links text-xs text-error">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

FloatingLabelInput.displayName = "FloatingLabelInput";
