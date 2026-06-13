import { amlWatchlistCategoryLabel } from "@/lib/admin/status-badge-variants";
import type { AdminAmlScreeningHitRow } from "@/lib/data/http/compliance.server";

type Props = {
  hits: AdminAmlScreeningHitRow[];
  /** Compact layout for client profile panels (fewer hits, shorter snippets). */
  compact?: boolean;
};

export function AdminAmlHitListings({ hits, compact = false }: Props) {
  if (hits.length === 0) {
    return <p className="text-sm text-on-surface-variant">No hit detail recorded.</p>;
  }

  const visibleHits = compact ? hits.slice(0, 2) : hits;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {visibleHits.map((hit, index) => (
        <div
          key={`${hit.matchedName ?? "hit"}-${index}`}
          className="rounded-md border border-outline-variant/40 p-3"
        >
          <p className="font-medium text-sm">{hit.matchedName ?? "Unknown matched name"}</p>
          {hit.matchTypes.length > 0 ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              Match types: {hit.matchTypes.join(", ")}
            </p>
          ) : null}
          {hit.countries.length > 0 ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              Countries: {hit.countries.join(", ")}
            </p>
          ) : null}
          {hit.dateOfBirth ? (
            <p className="mt-1 text-xs text-on-surface-variant">DOB: {hit.dateOfBirth}</p>
          ) : null}
          <div className="mt-3 space-y-2">
            {Object.entries(hit.listings).map(([category, listings]) =>
              listings && listings.length > 0 ? (
                <div key={category}>
                  <p className="font-label text-[10px] uppercase text-on-surface-variant">
                    {amlWatchlistCategoryLabel[category] ?? category}
                  </p>
                  <ul className="mt-1 space-y-2 text-sm">
                    {(compact ? listings.slice(0, 2) : listings).map((listing, listingIndex) => (
                      <li key={`${listing.sourceName}-${listingIndex}`}>
                        <p>{listing.sourceName}</p>
                        {listing.date ? (
                          <p className="text-xs text-on-surface-variant">{listing.date}</p>
                        ) : null}
                        {listing.snippet ? (
                          <p
                            className={
                              compact
                                ? "mt-1 line-clamp-2 text-xs text-on-surface-variant"
                                : "mt-1 text-xs text-on-surface-variant"
                            }
                          >
                            {listing.snippet}
                          </p>
                        ) : null}
                        {listing.sourceUrl ? (
                          <a
                            href={listing.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-link underline"
                          >
                            View source
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </div>
      ))}
      {compact && hits.length > visibleHits.length ? (
        <p className="text-xs text-on-surface-variant">
          +{hits.length - visibleHits.length} more hit
          {hits.length - visibleHits.length === 1 ? "" : "s"} — open the review queue for full
          detail.
        </p>
      ) : null}
    </div>
  );
}
