import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingCardMedia } from "./marketing-card-media.js";
import { MarketingCardShell } from "./marketing-card-shell.js";

export type MarketingCategoryTileProps = {
  href: string;
  label: string;
  /** Media filling the 288 / 295 frame (`absolute inset-0 size-full object-cover`). */
  image: ReactNode;
  /** Secondary line under the label, e.g. a work count. */
  meta?: string;
  /** Marks the tile for the filter currently applied. */
  active?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
};

/** Shop's category tile: photo frame with the label underneath; label takes the link colour on hover. */
export function MarketingCategoryTile({
  href,
  label,
  image,
  meta,
  active = false,
  headingLevel: Heading = "h3",
  className,
}: MarketingCategoryTileProps) {
  return (
    <MarketingCardShell asChild className={cn("flex flex-col gap-5", className)}>
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        data-active={active || undefined}
      >
        <MarketingCardMedia
          className={cn(
            "aspect-[288/295] rounded-[2px] bg-surface-container",
            active && "ring-2 ring-on-surface ring-offset-2 ring-offset-surface",
          )}
        >
          {image}
        </MarketingCardMedia>
        <div className="flex flex-col gap-1 px-5 pb-4">
          <Heading
            className={cn(
              "m-0 font-body text-lg font-semibold leading-[1.625rem] transition-colors duration-[var(--motion-duration-md,320ms)] group-hover:text-link group-focus-within:text-link",
              active ? "text-link" : "text-on-surface",
            )}
          >
            {label}
          </Heading>
          {meta ? <p className="m-0 text-sm text-on-surface-variant">{meta}</p> : null}
        </div>
      </Link>
    </MarketingCardShell>
  );
}
