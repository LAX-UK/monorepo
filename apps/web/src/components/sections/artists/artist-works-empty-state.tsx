import { ArtistWatchToggle } from "@/components/marketing/artist-watch-toggle";
import { ButtonLink, EmptyState } from "@auction/ui/lax";
import Link from "next/link";

type FollowProps = {
  artistId: string;
  artistName: string;
  watching: boolean;
  isAuthenticated: boolean;
  loginNextPath: string;
};

const CARD = "rounded-xl border border-border-hairline bg-surface";

/**
 * Nothing on sale: the one thing that brings the reader back is following the artist, so that is
 * the main action; a seller who holds a work by the artist gets the valuation route beside it.
 */
export function ArtistOnSaleEmptyState({
  artistId,
  artistName,
  watching,
  isAuthenticated,
  loginNextPath,
}: FollowProps) {
  return (
    <div className={CARD}>
      <EmptyState
        illustration="frame"
        headingLevel="h3"
        title={`No works by ${artistName} are on sale`}
        description={
          watching
            ? `You follow ${artistName}. We will email you when a work is consigned.`
            : `Follow ${artistName} and we will email you when a work is consigned.`
        }
        actions={
          <>
            <ArtistWatchToggle
              artistId={artistId}
              initialWatching={watching}
              isAuthenticated={isAuthenticated}
              loginNextPath={loginNextPath}
              emphasis="primary"
            />
            <ButtonLink Link={Link} variant="secondary" href="/selling/new">
              Sell a work by this artist
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}

/** No sold works yet: says when results appear, and where to look in the meantime. */
export function ArtistResultsEmptyState({ artistName }: { artistName: string }) {
  return (
    <div className={CARD}>
      <EmptyState
        illustration="plinth"
        headingLevel="h3"
        title={`No past results for ${artistName}`}
        description="Works sold at LAX appear here once their auction has ended."
        actions={
          <ButtonLink Link={Link} variant="secondary" href="/sales?tab=results">
            Browse past auctions
          </ButtonLink>
        }
      />
    </div>
  );
}
