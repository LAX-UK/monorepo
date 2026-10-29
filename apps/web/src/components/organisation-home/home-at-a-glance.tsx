import type { DashboardTileView } from "@/lib/organisation-home/organisation-dashboard-view";
import { HomeCellGrid } from "./home-cell-grid";
import { HomeFigureTile } from "./home-figure-tile";
import { HomeSection } from "./home-section";

/** Up to four figures for the role, as cells of one card: two to a row on phones. */
export function HomeAtAGlance({ tiles }: { tiles: readonly DashboardTileView[] }) {
  if (tiles.length === 0) return null;
  return (
    <HomeSection id="home-at-a-glance" title="At a glance">
      <HomeCellGrid
        labelledBy="home-at-a-glance"
        items={tiles}
        itemKey={(tile) => tile.id}
        phoneColumns={2}
        wideColumns={tiles.length}
        // One figure stays a figure-sized card rather than a band across the page.
        fit={tiles.length === 1}
        renderItem={(tile) => <HomeFigureTile tile={tile} />}
      />
    </HomeSection>
  );
}
