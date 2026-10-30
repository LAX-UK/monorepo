import type { DashboardTileView } from "@/lib/organisation-home/organisation-dashboard-view";
import { cn } from "@auction/ui";
import { MetricCell } from "@auction/ui/lax";
import Link from "next/link";
import { HomeSection } from "./home-section";

/** Columns from `lg`, spelled out so Tailwind keeps them. */
const WIDE: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/**
 * Up to four figures for the role, as cells of one card split by hairlines: two to a row on
 * phones. Each cell links to the page behind it. A figure with nothing to count says so in words
 * ("No open bids") rather than a lone £0.00; what each figure counts is read with it.
 */
export function HomeAtAGlance({ tiles }: { tiles: readonly DashboardTileView[] }) {
  if (tiles.length === 0) return null;
  const odd = tiles.length % 2 === 1;
  return (
    <HomeSection id="home-at-a-glance" title="At a glance">
      <ul
        aria-labelledby="home-at-a-glance"
        className={cn(
          "grid grid-cols-2 gap-px overflow-hidden rounded-lax-card border border-lax-line bg-lax-line-subtle",
          WIDE[Math.min(tiles.length, 4)],
          // One figure stays figure-sized rather than a band across the page.
          tiles.length === 1 && "lg:w-80",
        )}
      >
        {tiles.map((tile, index) => (
          <li
            key={tile.id}
            data-testid={`home-tile-${tile.id}`}
            className={cn(
              "flex min-w-0 bg-lax-surface",
              // The last of an odd number spans the phone row, so no row ends in a gap.
              odd && index === tiles.length - 1 && "col-span-2 lg:col-span-1",
            )}
          >
            <MetricCell
              Link={Link}
              // Phones: 16px padding and a 24/32 figure, so a full amount fits half the width.
              className="min-h-28 w-full max-sm:[&>dl]:!px-4 max-sm:[&>dl]:!py-4 lg:min-h-32"
              item={{
                id: tile.id,
                label: tile.label,
                value:
                  tile.figures.length > 0 ? (
                    <span className="flex flex-col max-sm:text-lax-24">
                      {tile.figures.map((figure) => (
                        <span key={figure}>{figure}</span>
                      ))}
                    </span>
                  ) : null,
                ...(tile.emptyText ? { emptyText: tile.emptyText } : {}),
                href: tile.href,
                hint: (
                  <>
                    {tile.supporting.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                    <span className="sr-only">{tile.description}</span>
                  </>
                ),
              }}
            />
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
