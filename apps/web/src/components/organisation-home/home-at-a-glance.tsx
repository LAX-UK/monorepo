import type { DashboardTileView } from "@/lib/organisation-home/organisation-dashboard-view";
import { cn } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import { HomeFigureTile } from "./home-figure-tile";
import { HomeSectionHeading } from "./home-section-heading";

/** Columns on wide screens, so one or two figures never sit in a half-empty row. */
const WIDE_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-2",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/** Up to four figures for the role, two to a row on phones. */
export function HomeAtAGlance({ tiles }: { tiles: readonly DashboardTileView[] }) {
  if (tiles.length === 0) return null;
  return (
    <Surface variant="section" padding="none" className="space-y-3 p-4 sm:p-6">
      <HomeSectionHeading id="home-at-a-glance">At a glance</HomeSectionHeading>
      <ul
        aria-labelledby="home-at-a-glance"
        className={cn(
          "grid gap-3",
          tiles.length === 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2",
          WIDE_COLUMNS[tiles.length],
        )}
      >
        {tiles.map((tile) => (
          <li key={tile.id} className="flex min-w-0">
            <HomeFigureTile tile={tile} />
          </li>
        ))}
      </ul>
    </Surface>
  );
}
