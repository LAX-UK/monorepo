"use client";

import { TextInput, type TextInputProps } from "@auction/ui/lax";
import * as React from "react";
import { formatRateAsPercent, parsePercentToRate } from "../lib/percent.js";

export type PercentInputProps = Omit<
  TextInputProps,
  "value" | "defaultValue" | "onChange" | "type" | "trailing" | "inputMode"
> & {
  /** The rate as a decimal string ("0.25" for 25%), or "" when empty. */
  value: string;
  /**
   * The rate as a decimal string, "" when the field is cleared, or null while the text is not a
   * number, so the form can say so on submit.
   */
  onValueChange: (rate: string | null) => void;
};

/**
 * A percent field that hands the form a decimal rate: staff type "25" and the form holds "0.25".
 * The text stays as typed while the field has focus, and the "%" sits in the trailing slot.
 */
export const PercentInput = React.forwardRef<HTMLInputElement, PercentInputProps>(
  ({ value, onValueChange, className, ...props }, ref) => {
    const [text, setText] = React.useState(() => (value ? formatRateAsPercent(value) : ""));
    const lastEmitted = React.useRef<string | null>(value);

    React.useEffect(() => {
      if (value === lastEmitted.current) return;
      // A value that is not a rate is the form holding on to text it will reject: keep the text.
      if (value !== "" && !/^\d+(\.\d*)?$/.test(value)) return;
      lastEmitted.current = value;
      setText(value ? formatRateAsPercent(value) : "");
    }, [value]);

    return (
      <TextInput
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        trailing={<span className="text-staff-muted">%</span>}
        className={["tabular-nums", className].filter(Boolean).join(" ")}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const parsed = parsePercentToRate(next);
          const rate = parsed.ok ? parsed.rate : parsed.reason === "empty" ? "" : null;
          lastEmitted.current = rate;
          onValueChange(rate);
        }}
        {...props}
      />
    );
  },
);
PercentInput.displayName = "PercentInput";
