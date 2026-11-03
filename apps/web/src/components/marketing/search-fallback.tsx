import { CatalogLotViewClient } from "@/components/marketing/catalog-lot-view-client";
import { SearchAlertButton } from "@/components/marketing/search-alert-button";
import { ArtistBrowseGrid } from "@/components/sections/artists/catalog-artist-views";
import { toCatalogLotVMs } from "@/lib/lot/to-catalog-lot-vm";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import type { SearchFallback } from "@/lib/marketing/load-search-fallback";
import { pastResultsSentence } from "@/lib/marketing/search-fallback";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { ButtonLink, EmptyState } from "@auction/ui/lax";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  q: string;
  categoryId?: string;
  fallback: SearchFallback;
  layoutView: CatalogLayoutView;
  isAuthenticated: boolean;
  currentUserId: string | null;
  watchedLotIds: string[];
  watchedArtistIds: ReadonlySet<string>;
  /** Search with every filter cleared. */
  clearHref: string;
  /** The same text, limited to past results. */
  pastResultsHref: string;
  /** This page with `alert=1`, for signing in and coming back. */
  alertReturnHref: string;
  saveAlertOnArrival: boolean;
  catalogLinkParams?: CatalogLinkParams;
};

function Group({
  id,
  title,
  note,
  action,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id={id} className="font-lax-display text-lax-20 font-semibold text-lax-fg">
            {title}
          </h2>
          {note ? <p className="mt-1 text-lax-14 text-lax-muted">{note}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * The page when nothing on sale matches: it says so, offers an alert, and shows what the same
 * words find in past results and among artists.
 */
export function SearchNoMatches(props: Props) {
  const { q, fallback, categoryId } = props;
  const { pastLots, pastCount, artists } = fallback;
  const sentence = pastResultsSentence(pastCount);
  const hint = "Check the spelling, or try an artist, a medium or a place.";

  return (
    <>
      <div className="mt-8 rounded-lax-card border border-lax-line bg-lax-surface">
        <EmptyState
          illustration="search"
          headingLevel="h2"
          title={`No lots on sale match “${q}”`}
          description={sentence ? `${hint} ${sentence}` : hint}
          actions={
            <>
              <SearchAlertButton
                isAuthenticated={props.isAuthenticated}
                q={q}
                {...(categoryId ? { categoryId } : {})}
                returnHref={props.alertReturnHref}
                saveOnArrival={props.saveAlertOnArrival}
              />
              <ButtonLink Link={Link} variant="ghost" href={props.clearHref}>
                Clear search
              </ButtonLink>
            </>
          }
        />
      </div>

      {pastLots.length > 0 ? (
        <Group
          id="search-past-results"
          title={`Past results for “${q}”`}
          note="Sold at LAX Bid. Prices include buyer’s premium."
          action={
            pastCount > pastLots.length ? (
              <Link
                href={props.pastResultsHref}
                className="text-lax-14 font-medium text-lax-fg underline underline-offset-4"
              >
                See all {pastCount} past results
              </Link>
            ) : null
          }
        >
          <CatalogLotViewClient
            initialView={props.layoutView}
            lots={toCatalogLotVMs(pastLots)}
            currentUserId={props.currentUserId}
            isAuthenticated={props.isAuthenticated}
            watchedLotIds={props.watchedLotIds}
            loginNextPath={props.alertReturnHref}
            {...(props.catalogLinkParams ? { catalogLinkParams: props.catalogLinkParams } : {})}
          />
        </Group>
      ) : null}

      {artists.length > 0 ? (
        <Group id="search-artists" title="Artists">
          <ArtistBrowseGrid
            rows={artists}
            watchSet={props.watchedArtistIds}
            isAuthenticated={props.isAuthenticated}
          />
        </Group>
      ) : null}
    </>
  );
}
