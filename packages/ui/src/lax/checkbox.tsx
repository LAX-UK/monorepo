"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils.js";

export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

/**
 * The LAX checkbox: one build for every list and form. 16px for staff and 20px in the client
 * workspace, a 4px radius, the 3:1 control edge when empty and an ink fill with a check when on
 * (or a dash when `checked="indeterminate"`). The visible box is not the touch target: put it in
 * a row cell or label of 44px, as the list rows do.
 */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer group inline-grid size-4 shrink-0 place-items-center rounded-lax-badge border bg-lax-surface text-lax-on-ink",
      "in-data-[lax-density=client]:size-5",
      "border-lax-control-edge hover:border-lax-control-edge-hover",
      "transition-[background-color,border-color] duration-150 ease-out",
      "lax-focus",
      "data-[state=checked]:border-lax-ink data-[state=checked]:bg-lax-ink hover:data-[state=checked]:border-lax-ink-hover hover:data-[state=checked]:bg-lax-ink-hover",
      "data-[state=indeterminate]:border-lax-ink data-[state=indeterminate]:bg-lax-ink hover:data-[state=indeterminate]:border-lax-ink-hover hover:data-[state=indeterminate]:bg-lax-ink-hover",
      "disabled:cursor-not-allowed disabled:border-lax-line disabled:bg-lax-sunken disabled:text-lax-disabled-fg",
      "disabled:data-[state=checked]:border-lax-line disabled:data-[state=checked]:bg-lax-line",
      "disabled:data-[state=indeterminate]:border-lax-line disabled:data-[state=indeterminate]:bg-lax-line",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="grid place-items-center text-current">
      <Check
        aria-hidden
        strokeWidth={2.5}
        className="size-3 in-data-[lax-density=client]:size-3.5 group-data-[state=indeterminate]:hidden"
      />
      <Minus
        aria-hidden
        strokeWidth={2.5}
        className="hidden size-3 in-data-[lax-density=client]:size-3.5 group-data-[state=indeterminate]:block"
      />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
