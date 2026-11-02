import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils.js";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-on-surface [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "border-outline-variant/20 bg-surface-container-low text-on-surface",
        destructive: "border-error/50 text-error [&>svg]:text-error",
        warning:
          "border-warning/50 bg-warning-container/30 text-on-surface [&>svg]:text-warning-on-surface",
        success: "border-success/50 bg-success-container/25 text-on-surface [&>svg]:text-success",
        /** High-emphasis prompt on the CTA fill, e.g. lax.art "You're almost ready" (Figma 930:14088). */
        inverse: "border-transparent bg-cta-bg text-cta-on [&>svg]:text-cta-on",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

export type AlertTitleLevel = "h2" | "h3" | "h4" | "h5" | "h6";

type AlertTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  /**
   * The heading level that fits where the alert sits: h2 directly under the page title, h3
   * inside a section that has its own h2. Never skip a level. Defaults to h2.
   */
  as?: AlertTitleLevel;
};

const AlertTitle = React.forwardRef<HTMLHeadingElement, AlertTitleProps>(
  ({ className, as: Heading = "h2", ...props }, ref) => (
    <Heading
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription, alertVariants };
