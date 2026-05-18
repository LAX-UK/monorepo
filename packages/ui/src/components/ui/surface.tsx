import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils.js";

const surfaceVariants = cva("text-on-surface", {
  variants: {
    variant: {
      card: "rounded-2xl border border-border-hairline bg-surface-container-lowest shadow-md",
      section: "rounded-xl border border-border-hairline bg-surface-container-lowest/40 p-4 sm:p-6",
      inset: "rounded-xl border border-border-hairline bg-surface-container-low overflow-hidden",
      quiet: "rounded-lg bg-surface-container-low",
    },
    padding: {
      none: "",
      sm: "p-3",
      md: "p-4 sm:p-5",
      lg: "p-5 sm:p-6",
    },
    interactive: {
      true: "transition-colors hover:bg-surface-container-high/50 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
      false: "",
    },
  },
  defaultVariants: {
    variant: "card",
    padding: "none",
    interactive: false,
  },
});

export type SurfaceProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof surfaceVariants>;

export function Surface({ className, variant, padding, interactive, ...props }: SurfaceProps) {
  return (
    <div className={cn(surfaceVariants({ variant, padding, interactive }), className)} {...props} />
  );
}

export { surfaceVariants };
