import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingCardMedia } from "./marketing-card-media.js";
import { MarketingCardShell } from "./marketing-card-shell.js";

export type MarketingVenueCardProps = {
  href: string;
  name: string;
  /** Street, then postcode line; empty lines are skipped. */
  addressLines: readonly string[];
  /** Media filling the frame (`absolute inset-0 size-full object-cover`). */
  image: ReactNode;
  headingLevel?: "h2" | "h3";
  className?: string;
};

/** Gallery location tile: photograph, name and postal address (Figma home "Our galleries", `880:21501`). */
export function MarketingVenueCard({
  href,
  name,
  addressLines,
  image,
  headingLevel: Heading = "h3",
  className,
}: MarketingVenueCardProps) {
  const lines = addressLines.filter((line) => line.trim().length > 0);

  return (
    <MarketingCardShell asChild className={cn("flex h-full flex-col rounded-none", className)}>
      <Link href={href}>
        <MarketingCardMedia className="aspect-[33/32] bg-surface-container">
          {image}
        </MarketingCardMedia>
        <div className="flex flex-col gap-2 py-6 sm:pr-4">
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
        </div>
      </Link>
    </MarketingCardShell>
  );
}
