import * as React from "react";
import { cn } from "../../lib/utils.js";
import { type FieldVariant, fieldVariantClasses } from "./field-variant.js";

export type TextareaProps = React.ComponentProps<"textarea"> & {
  variant?: FieldVariant;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = "boxed", ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
Textarea.displayName = "Textarea";

export { Textarea };
