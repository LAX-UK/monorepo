import { amlWatchlistCategoryLabel } from "@/lib/admin/status-badge-variants";
import type { AdminAmlScreeningHitRow } from "@/lib/data/http/compliance.server";
import { type KeyValueItem, KeyValueList } from "@auction/staff-ui";

type Props = {
  hits: AdminAmlScreeningHitRow[];
  /** Fewer hits and listings, for a client's page; the AML list has the full detail. */
  compact?: boolean;
};

function hitItems(hit: AdminAmlScreeningHitRow, compact: boolean): KeyValueItem[] {
  const listings = Object.entries(hit.listings).flatMap(([category, entries]) =>
    entries && entries.length > 0
      ? [
          {
            label: amlWatchlistCategoryLabel[category] ?? category,
            value: (
              <ul className="flex flex-col gap-1.5">
                {(compact ? entries.slice(0, 2) : entries).map((entry, index) => (
                  <li key={`${entry.sourceName}-${index}`}>
                    <span>{entry.sourceName}</span>
                    {entry.date ? <span className="text-staff-muted">, {entry.date}</span> : null}
                    {entry.snippet ? (
                      <span className="block text-staff-muted">{entry.snippet}</span>
                    ) : null}
                    {entry.sourceUrl ? (
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        View source
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ),
          },
        ]
      : [],
  );
  return [
    { label: "Match types", value: hit.matchTypes.join(", ") || null },
    { label: "Countries", value: hit.countries.join(", ") || null },
    { label: "Date of birth", value: hit.dateOfBirth },
    ...listings,
  ];
}

/** The people and listings a watchlist screening matched, one block per hit. */
export function AdminAmlHitListings({ hits, compact = false }: Props) {
  if (hits.length === 0) {
    return <p className="text-staff-sm text-staff-muted">No hit detail recorded.</p>;
  }
  const visible = compact ? hits.slice(0, 2) : hits;
  const hidden = hits.length - visible.length;

  return (
    <div className="flex flex-col gap-3">
      {visible.map((hit, index) => (
        <div
          key={`${hit.matchedName ?? "hit"}-${index}`}
          className="rounded-staff-sm border border-staff-line px-3 py-2"
        >
          <p className="py-1 text-staff-sm font-medium text-staff-fg">
            {hit.matchedName ?? "Name not given"}
          </p>
          <KeyValueList items={hitItems(hit, compact)} />
        </div>
      ))}
      {hidden > 0 ? (
        <p className="text-staff-sm text-staff-muted">
          {hidden} more {hidden === 1 ? "hit" : "hits"}. Open the AML list for the full detail.
        </p>
      ) : null}
    </div>
  );
}
