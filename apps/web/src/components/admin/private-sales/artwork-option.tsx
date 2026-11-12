import { type EntityOption, RecordThumbnail, WhereItIsChip } from "@auction/staff-ui";
import type { DealArtworkOption } from "@auction/validators";

/** Under the list's first heading when staff have not typed yet. */
export const SUGGESTED_GROUP = "Suggested from the enquiry";
const HELD_GROUP = "Can be held";
const LOCKED_GROUP = "Can't be held now";

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
  { suggestions }: { suggestions: boolean },
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
        ? SUGGESTED_GROUP
        : HELD_GROUP
      : LOCKED_GROUP,
    ...(artwork.available
      ? {}
      : { disabledReason: artwork.lock?.message ?? "This artwork can't be held for a deal." }),
  };
}
