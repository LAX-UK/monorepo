import * as React from "react";
import { cn } from "../../lib/utils.js";
import { type FieldVariant, fieldVariantClasses } from "./field-variant.js";

export type InputProps = React.ComponentProps<"input"> & {
  variant?: FieldVariant;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "boxed", ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full py-1 text-base text-on-surface transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-on-surface placeholder:text-on-surface-variant focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        variant === "boxed" &&
          "px-3 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        fieldVariantClasses(variant),
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
