import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingCardMedia } from "./marketing-card-media.js";
import { MarketingCardShell } from "./marketing-card-shell.js";
import { MarketingArrowRightIcon } from "./marketing-icons.js";

export type MarketingVenueCardProps = {
  href: string;
  name: string;
  /** Street, then postcode line; empty lines are skipped. */
  addressLines: readonly string[];
  /** Media filling the frame (`absolute inset-0 size-full object-cover`). */
  image: ReactNode;
  headingLevel?: "h2" | "h3";
  /**
   * `tile` (default) stacks the photograph over the name, for a grid of galleries. `wide` puts
   * them side by side from `md`, for a single gallery that would otherwise leave half a row empty.
   */
  layout?: "tile" | "wide";
  /** Visible cue for where the card leads, e.g. "Plan your visit". The whole card is the link. */
  cta?: string;
  className?: string;
};

const LAYOUT = {
  tile: { card: "flex h-full flex-col", media: "aspect-[33/32]", text: "py-6 sm:pr-4" },
  wide: {
    card: "flex h-full flex-col md:grid md:grid-cols-[7fr_5fr] md:items-center md:gap-12",
    media: "aspect-[4/3]",
    text: "py-6 md:py-0",
  },
} as const;

/** Gallery location tile: photograph, name and postal address (Figma home "Our galleries", `880:21501`). */
export function MarketingVenueCard({
  href,
  name,
  addressLines,
  image,
  headingLevel: Heading = "h3",
  layout = "tile",
  cta,
  className,
}: MarketingVenueCardProps) {
  const lines = addressLines.filter((line) => line.trim().length > 0);
  const styles = LAYOUT[layout];

  return (
    <MarketingCardShell
      asChild
      className={cn("rounded-none", styles.card, className)}
      data-layout={layout}
    >
      <Link href={href}>
        <MarketingCardMedia className={cn(styles.media, "bg-surface-container")}>
          {image}
        </MarketingCardMedia>
        <div className={cn("flex flex-col gap-2", styles.text)}>
          <Heading className="m-0 font-headline text-2xl font-medium leading-tight text-on-surface group-hover:underline sm:text-[1.75rem]">
            {name}
          </Heading>
          {lines.length > 0 ? (
            <address className="flex flex-col gap-1 text-base not-italic text-on-surface-variant sm:text-lg">
              {lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
          ) : null}
          {cta ? (
            <span className="mt-4 inline-flex items-center gap-2 font-label text-base font-medium text-on-surface underline decoration-1 underline-offset-4 group-hover:decoration-2">
              {cta}
              <MarketingArrowRightIcon className="size-4" />
            </span>
          ) : null}
        </div>
      </Link>
    </MarketingCardShell>
  );
}
