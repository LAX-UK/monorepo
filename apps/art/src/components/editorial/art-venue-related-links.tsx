import { MARKETING_PAGE_SHELL } from "@auction/branding";
import type { MarketingSectionSurface } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

const RELATED = [
  { href: "/how-to-buy", label: "How to buy" },
  { href: "/how-to-sell", label: "How to sell" },
  { href: "/collector-hub", label: "Collecting" },
] as const;

/**
 * Section surface, then the tile on it: on the cream band the tiles are plain; on the page they
 * take the paper tone, so they still read as tiles.
 */
const SURFACE: Record<MarketingSectionSurface, { section: string; tile: string }> = {
  band: {
    section: "bg-[var(--color-surface-feature,var(--color-surface-container-low))] py-12 md:py-16",
    tile: "bg-surface",
  },
  plain: {
    section: "",
    tile: "bg-[var(--color-surface-feature,var(--color-surface-container-low))]",
  },
};

/**
 * "You may also like" (Figma `821:11603`); links only, no imagery. On the cream feature band, or
 * on the page when it follows another tinted band.
 */
export function ArtVenueRelatedLinks({
  surface = "band",
}: {
  surface?: MarketingSectionSurface;
}) {
  const styles = SURFACE[surface];
  return (
    <section
      aria-labelledby="venue-related-title"
      className={styles.section}
      data-surface={surface}
    >
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8")}>
        <h2
          id="venue-related-title"
          className="m-0 font-headline text-3xl font-medium text-on-surface md:text-4xl"
        >
          You may also like
        </h2>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {RELATED.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "art-focus-ring flex min-h-24 items-end rounded-lg p-6 font-headline text-xl font-medium text-on-surface underline-offset-4 hover:underline",
                  styles.tile,
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
