import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingPullQuoteProps = {
  children: ReactNode;
  attribution?: string;
  variant?: "default" | "accent";
  className?: string;
};

export function MarketingPullQuote({
  children,
  attribution,
  variant = "default",
  className,
}: MarketingPullQuoteProps) {
  return (
    <figure className={className}>
      <blockquote
        className={cn(
          "rounded-r-md border-l-2 py-1 pl-3 font-body text-sm italic leading-relaxed",
          variant === "default" &&
            "border-primary/30 bg-surface-container-low/40 text-on-surface-variant",
          variant === "accent" && "border-primary bg-surface-container-low/60 text-on-surface",
        )}
      >
        <span aria-hidden className="text-primary/60">
          &ldquo;
        </span>
        {children}
        <span aria-hidden className="text-primary/60">
          &rdquo;
        </span>
      </blockquote>
      {attribution ? (
        <figcaption className="mt-2 pl-3 text-sm text-on-surface-variant">{attribution}</figcaption>
      ) : null}
    </figure>
  );
}
