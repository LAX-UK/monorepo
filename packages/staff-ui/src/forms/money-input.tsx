"use client";

import { TextInput, type TextInputProps } from "@auction/ui/lax";
import * as React from "react";
import { formatPenceAsPounds, parsePoundsToPence } from "../lib/money.js";

export type MoneyInputProps = Omit<
  TextInputProps,
  "value" | "defaultValue" | "onChange" | "type" | "leading" | "inputMode"
> & {
  /** Whole pence, or null when empty or not yet a valid amount. */
  value: number | null;
  onValueChange: (pence: number | null) => void;
};

/**
 * A pounds field that hands the form whole pence. The text stays exactly as typed while the field
 * has focus, and is tidied to two decimals on blur, so typing is never fought. Amounts appear in
 * tabular figures so a column of values lines up.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, onBlur, className, ...props }, ref) => {
    const [text, setText] = React.useState(() => (value == null ? "" : formatPenceAsPounds(value)));
    const lastEmitted = React.useRef<number | null>(value);

    React.useEffect(() => {
      if (value === lastEmitted.current) return;
      lastEmitted.current = value;
      setText(value == null ? "" : formatPenceAsPounds(value));
    }, [value]);

    return (
      <TextInput
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        leading={<span className="text-staff-muted">£</span>}
        className={["tabular-nums", className].filter(Boolean).join(" ")}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const parsed = parsePoundsToPence(next);
          const pence = parsed.ok ? parsed.pence : null;
          lastEmitted.current = pence;
          onValueChange(pence);
        }}
        onBlur={(event) => {
          const parsed = parsePoundsToPence(text);
          if (parsed.ok) setText(formatPenceAsPounds(parsed.pence));
          onBlur?.(event);
        }}
        {...props}
      />
    );
  },
);
MoneyInput.displayName = "MoneyInput";
