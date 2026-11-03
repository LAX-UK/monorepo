import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils.js";
import { LaxIllustration, type LaxIllustrationName } from "./lax-illustration.js";

/**
 * The LAX empty state: illustration, title (Montserrat), one helpful sentence (Outfit), then at
 * most one primary action and one secondary link. Used for first use, no results, errors, no
 * access and not found, at three sizes: `page` replaces a page's content, `panel` sits in a
 * section, `compact` sits inside a table or a short list.
 */
const emptyStateVariants = cva("flex flex-col items-center justify-center text-center", {
  variants: {
    variant: {
      default:
        "rounded-xl border border-dashed border-outline-variant/25 bg-surface-container-low/40",
      marketing: "bg-transparent",
      plain: "bg-transparent",
    },
    size: {
      page: "min-h-[min(60vh,32rem)] px-6 py-16 md:px-8 md:py-24",
      panel: "px-6 py-10 md:px-8 md:py-14",
      compact: "px-4 py-8",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "panel",
  },
});

const TITLE_CLASS = {
  page: "text-2xl md:text-[1.75rem] md:leading-9",
  panel: "text-lg md:text-xl",
  compact: "text-base",
} as const;

const ILLUSTRATION_GAP = { page: "mb-8", panel: "mb-6", compact: "mb-4" } as const;

const emptyStateIconSlotVariants = cva("mb-4 [&_svg]:size-12", {
  variants: {
    variant: {
      default: "text-primary",
      marketing: "text-brand-300 dark:text-on-surface-variant",
      plain: "text-on-surface-variant",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type EmptyStateProps = {
  /** Legacy small icon. Prefer `illustration`. */
  icon?: React.ReactNode;
  /** A drawing from the LAX illustration set, or a custom element. */
  illustration?: LaxIllustrationName | React.ReactElement;
  title: React.ReactNode;
  headingLevel?: "h1" | "h2" | "h3";
  /** When set, applied to the title element for `aria-labelledby` on a parent region. */
  headingId?: string;
  description?: React.ReactNode;
  /** One primary action and, at most, one secondary link. */
  action?: React.ReactNode;
  /** `alert` for errors that replace content after a failed load. */
  role?: "alert" | "status";
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
  size,
  role,
  headingLevel = "h3",
  headingId,
}: EmptyStateProps) {
  const Heading = headingLevel;
  const resolvedSize = size ?? "panel";
  const art =
    typeof illustration === "string" ? (
      <LaxIllustration
        name={illustration}
        size={resolvedSize === "compact" ? "compact" : resolvedSize}
      />
    ) : React.isValidElement(illustration) ? (
      <div className="max-w-xs text-on-surface-variant [&_svg]:max-h-32">{illustration}</div>
    ) : null;

  return (
    <div
      {...(role ? { role } : {})}
      className={cn(emptyStateVariants({ variant, size }), className)}
    >
      {art ? <div className={ILLUSTRATION_GAP[resolvedSize]}>{art}</div> : null}
      {icon && !art ? <div className={emptyStateIconSlotVariants({ variant })}>{icon}</div> : null}
      <Heading
        {...(headingId ? { id: headingId } : {})}
        className={cn(
          "max-w-lg text-balance font-headline font-semibold tracking-tight text-on-surface",
          TITLE_CLASS[resolvedSize],
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p
          className={cn(
            "mt-2 max-w-md text-pretty font-[family-name:var(--font-outfit,var(--font-body))] text-on-surface-variant",
            resolvedSize === "compact" ? "text-sm" : "text-sm md:text-base",
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? (
        <div
          className={cn(
            "flex w-full max-w-sm flex-col items-center gap-3 sm:flex-row sm:justify-center",
            resolvedSize === "compact" ? "mt-4" : "mt-6",
          )}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}
