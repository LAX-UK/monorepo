import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils.js";

const emptyStateVariants = cva("flex flex-col items-center justify-center px-8 py-16 text-center", {
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
});

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
  title: string;
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
}: EmptyStateProps) {
  return (
    <div className={cn(emptyStateVariants({ variant }), className)}>
      {illustration ? (
        <div className="mb-6 max-w-xs text-on-surface-variant [&_svg]:max-h-32">{illustration}</div>
      ) : null}
      {icon ? <div className={emptyStateIconSlotVariants({ variant })}>{icon}</div> : null}
      <h3 className="font-headline text-xl text-on-surface">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-on-surface-variant">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
