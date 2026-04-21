"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";
import { FloatingLabelInput } from "./floating-label-input.js";

export type PasswordInputProps = Omit<
  React.ComponentProps<typeof FloatingLabelInput>,
  "type" | "endAdornment"
>;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, onKeyDown, ariaDescribedByExtra, ...rest }, ref) {
    const [visible, setVisible] = React.useState(false);
    const [capsOn, setCapsOn] = React.useState(false);
    const capsId = React.useId();
    const mergedExtra = [ariaDescribedByExtra, capsOn ? capsId : undefined].filter(Boolean).join(" ");

    return (
      <div className={cn("w-full", className)}>
        <FloatingLabelInput
          ref={ref}
          type={visible ? "text" : "password"}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          {...(mergedExtra.trim() ? { ariaDescribedByExtra: mergedExtra.trim() } : {})}
          onKeyDown={(e) => {
            if (e.getModifierState) {
              setCapsOn(e.getModifierState("CapsLock"));
            }
            onKeyDown?.(e);
          }}
          endAdornment={
            <button
              type="button"
              className="min-h-[44px] min-w-[44px] px-2 py-2 font-footer-links text-xs font-medium text-on-surface-variant underline decoration-on-surface-variant underline-offset-2 transition-colors hover:text-on-surface focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => setVisible((v) => !v)}
              aria-pressed={visible}
              aria-label={visible ? "Hide password" : "Show password"}
            >
              {visible ? "Hide" : "Show"}
            </button>
          }
          {...rest}
        />
        {capsOn ? (
          <p
            id={capsId}
            className="mt-1 font-footer-links text-xs text-on-surface-variant"
            role="status"
          >
            Caps Lock is on
          </p>
        ) : null}
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
