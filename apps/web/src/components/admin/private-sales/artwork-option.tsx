import { type EntityOption, RecordThumbnail, WhereItIsChip } from "@auction/staff-ui";
import type { DealArtworkOption } from "@auction/validators";

/** Under the list's first heading when staff have not typed yet. */
export const SUGGESTED_GROUP = "Suggested from the enquiry";
const HELD_GROUP = "Can be held";
const LOCKED_GROUP = "Can't be held now";

/** What the enquiry described, as the heading over the suggestions says it. */
export type EnquirySuggestion = { artist: string | null; title: string | null };

function suggestedHeading(suggestion: EnquirySuggestion | null | undefined): string {
  const described = [suggestion?.artist, suggestion?.title].filter(Boolean).join(", ");
  return described ? `${SUGGESTED_GROUP} · ${described}` : SUGGESTED_GROUP;
}

/** A draft linked to the artwork cannot be published while a deal holds it; says which draft. */
export function draftWarning(
  artwork: Pick<DealArtworkOption, "whereItIs" | "draftLot">,
): string | null {
  if (artwork.whereItIs.key === "draft_bid_lot") {
    const sale = artwork.draftLot?.saleName;
    return `A draft lot${sale ? ` in ${sale}` : ""} is linked. It can't be published while a deal holds the artwork.`;
  }
  if (artwork.whereItIs.key === "draft_lax_art") {
    return "A lax.art draft is linked. It can't be published while a deal holds the artwork.";
  }
  return null;
}

/** Artist and stock code: how staff tell two pieces by one artist apart. */
export function artworkDescription(artwork: Pick<DealArtworkOption, "artist" | "stockCode">) {
  return `${artwork.artist} · ${artwork.stockCode}`;
}

/**
 * An original as a picker option: its picture, title, artist and stock code, and where it is now.
 * One the register would not hold is locked, and says why in the lock's own words.
 */
export function toArtworkOption(
  artwork: DealArtworkOption,
  { suggestions, suggestion }: { suggestions: boolean; suggestion?: EnquirySuggestion | null },
  thumbnail = "size-10",
): EntityOption {
  return {
    id: artwork.id,
    label: artwork.title,
    description: artworkDescription(artwork),
    leading: (
      <RecordThumbnail src={artwork.thumbnailUrl} title={artwork.title} className={thumbnail} />
    ),
    meta: <WhereItIsChip chip={artwork.whereItIs.chip} />,
    group: artwork.available
      ? suggestions && artwork.suggested
        ? suggestedHeading(suggestion)
        : HELD_GROUP
      : LOCKED_GROUP,
    ...(artwork.available
      ? draftWarning(artwork)
        ? { note: draftWarning(artwork) as string }
        : {}
      : { disabledReason: artwork.lock?.message ?? "This artwork can't be held for a deal." }),
  };
}
