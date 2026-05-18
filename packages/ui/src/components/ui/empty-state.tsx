import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils.js";

const emptyStateVariants = cva(
  "flex flex-col items-center justify-center px-6 py-10 text-center md:px-8 md:py-16",
  {
    variants: {
      variant: {
        default:
          "rounded-xl border border-dashed border-outline-variant/25 bg-surface-container-low/40",
        marketing: "bg-transparent py-12",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const emptyStateIconSlotVariants = cva("mb-4 [&_svg]:size-12", {
  variants: {
    variant: {
      default: "text-primary",
      marketing: "text-brand-300 dark:text-on-surface-variant",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type EmptyStateProps = {
  icon?: React.ReactNode;
  /** Larger decorative slot (illustration, empty artwork, etc.) */
  illustration?: React.ReactNode;
  title: React.ReactNode;
  headingLevel?: "h2" | "h3";
  /** When set, applied to the title element for `aria-labelledby` on a parent region. */
  headingId?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
} & VariantProps<typeof emptyStateVariants>;

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  className,
  variant,
  headingLevel = "h3",
  headingId,
}: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div className={cn(emptyStateVariants({ variant }), className)}>
      {illustration ? (
        <div className="mb-6 max-w-xs text-on-surface-variant [&_svg]:max-h-32">{illustration}</div>
      ) : null}
      {icon ? <div className={emptyStateIconSlotVariants({ variant })}>{icon}</div> : null}
      <Heading id={headingId} className="font-headline text-lg text-on-surface md:text-xl">
        {title}
      </Heading>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-on-surface-variant">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
          {action}
        </div>
      ) : null}
    </div>
  );
}
