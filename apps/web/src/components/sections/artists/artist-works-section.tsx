import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import {
  ArtistOnSaleEmptyState,
  ArtistResultsEmptyState,
} from "@/components/sections/artists/artist-works-empty-state";
import { ArtistWorksGrid } from "@/components/sections/artists/artist-works-grid";
import {
  type ArtistWorks,
  type ArtistWorksTab,
  artistWorksTabItems,
} from "@/lib/artists/artist-works";
import { TabNav } from "@auction/ui/lax";
import Link from "next/link";

type Props = {
  artistId: string;
  artistName: string;
  profilePath: string;
  works: ArtistWorks;
  activeTab: ArtistWorksTab;
  currentUserId: string | null;
  watching: boolean;
  isAuthenticated: boolean;
};

/** The artist's works: "On sale" and "Past results" as tabs, each a real address. */
export function ArtistWorksSection({
  artistId,
  artistName,
  profilePath,
  works,
  activeTab,
  currentUserId,
  watching,
  isAuthenticated,
}: Props) {
  const lots = activeTab === "results" ? works.results : works.onSale;
  const label = activeTab === "results" ? "Past results" : "On sale";

  return (
    <section id="works" aria-labelledby="artist-works-heading" className="scroll-mt-24">
      <h2
        id="artist-works-heading"
        className="mb-4 font-headline text-[length:clamp(1.5rem,2.8vw,2rem)] font-medium leading-tight text-on-surface"
      >
        Works
      </h2>
      <TabNav
        label="Works by this artist"
        Link={Link}
        activeId={activeTab}
        items={artistWorksTabItems({ profilePath, works })}
        overflow="scroll"
        className="mb-8"
      />
      {lots.length > 0 ? (
        <>
          <ViewItemListTracker
            listId={`artist:${artistId}:${activeTab}`}
            listName={`Artist works: ${label}`}
            itemIds={lots.map((l) => l.id)}
          />
          <ArtistWorksGrid lots={lots} currentUserId={currentUserId} label={label} />
        </>
      ) : activeTab === "results" ? (
        <ArtistResultsEmptyState artistName={artistName} />
      ) : (
        <ArtistOnSaleEmptyState
          artistId={artistId}
          artistName={artistName}
          watching={watching}
          isAuthenticated={isAuthenticated}
          loginNextPath={profilePath}
        />
      )}
    </section>
  );
}
