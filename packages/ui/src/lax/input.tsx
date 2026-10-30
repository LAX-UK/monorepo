"use client";

import * as React from "react";
import { cn } from "../lib/utils.js";
import { useField, useReadOnlyView } from "./field.js";
import { fieldBox, readOnlyBox } from "./styles.js";

const fieldSize = {
  sm: "h-lax-control-sm text-lax-ui",
  md: "h-lax-control-md text-lax-14",
  /** 44px at every pointer: fields filled under time pressure. */
  lg: "h-lax-control-lg text-lax-14",
} as const;

const bareInput =
  "h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-lax-subtle disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:hidden";

export type TextInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: keyof typeof fieldSize;
  /** Icon or text before the value, e.g. a search icon or "£". */
  leading?: React.ReactNode;
  /** Icon, unit or action after the value, e.g. a kbd hint. */
  trailing?: React.ReactNode;
  invalid?: boolean;
  /** Classes for the outer box (width, margins); `className` styles the input itself. */
  boxClassName?: string;
};

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    { size = "md", leading, trailing, invalid, boxClassName, className, id, disabled, ...props },
    ref,
  ) => {
    const field = useField();
    const isInvalid = invalid ?? field?.invalid ?? false;
    const describedBy = props["aria-describedby"] ?? field?.describedBy;
    const inReadOnlyView = useReadOnlyView();
    const readOnly = props.readOnly ?? (field?.readOnly || inReadOnlyView);
    return (
      <div
        {...(readOnly ? { "data-readonly": "" } : {})}
        className={cn(fieldBox, readOnlyBox, fieldSize[size], "lax-target", boxClassName)}
      >
        {leading}
        <input
          ref={ref}
          id={id ?? field?.controlId}
          disabled={disabled ?? field?.disabled}
          aria-invalid={isInvalid || undefined}
          {...(describedBy ? { "aria-describedby": describedBy } : {})}
          {...(field?.required && props.required === undefined ? { "aria-required": true } : {})}
          className={cn(bareInput, readOnly && "placeholder:opacity-0", className)}
          {...props}
          readOnly={readOnly}
        />
        {trailing}
      </div>
    );
  },
);
TextInput.displayName = "TextInput";

export type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ invalid, className, id, disabled, rows = 3, ...props }, ref) => {
    const field = useField();
    const isInvalid = invalid ?? field?.invalid ?? false;
    const describedBy = props["aria-describedby"] ?? field?.describedBy;
    const inReadOnlyView = useReadOnlyView();
    const readOnly = props.readOnly ?? (field?.readOnly || inReadOnlyView);
    return (
      <div
        {...(readOnly ? { "data-readonly": "" } : {})}
        className={cn(fieldBox, readOnlyBox, "items-stretch px-0 py-0 text-lax-14")}
      >
        <textarea
          ref={ref}
          rows={rows}
          id={id ?? field?.controlId}
          disabled={disabled ?? field?.disabled}
          aria-invalid={isInvalid || undefined}
          {...(describedBy ? { "aria-describedby": describedBy } : {})}
          className={cn(
            "min-h-[76px] w-full resize-y bg-transparent px-3 py-2 outline-none placeholder:text-lax-subtle disabled:cursor-not-allowed",
            readOnly && "resize-none placeholder:opacity-0",
            className,
          )}
          {...props}
          readOnly={readOnly}
        />
      </div>
    );
  },
);
TextArea.displayName = "TextArea";
