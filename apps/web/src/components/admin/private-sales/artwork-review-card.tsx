import { KeyValueList, RecordThumbnail, WhereItIsChip } from "@auction/staff-ui";
import type { DealArtworkOption } from "@auction/validators";
import { CircleAlert } from "lucide-react";
import { draftWarning } from "./artwork-option";

/**
 * The chosen artwork, so staff can see they picked the right piece before anything is held: its
 * picture, title, artist, medium and size, stock code, where it is now and Zoho's status.
 */
export function ArtworkReviewCard({ artwork }: { artwork: DealArtworkOption }) {
  const warning = draftWarning(artwork);
  const mediumAndSize = [artwork.medium, artwork.size].filter(Boolean).join(", ");
  return (
    <section
      aria-label="Chosen artwork"
      className="flex flex-col gap-3 rounded-staff-md border border-staff-line bg-staff-surface p-3"
    >
      <div className="flex gap-3">
        <RecordThumbnail src={artwork.thumbnailUrl} title={artwork.title} className="size-16" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h4 className="text-staff-md font-semibold text-staff-fg">{artwork.title}</h4>
          <KeyValueList
            items={[
              { label: "Artist", value: artwork.artist },
              { label: "Stock code", value: artwork.stockCode },
              { label: "Medium and size", value: mediumAndSize || null },
              { label: "Where it is now", value: <WhereItIsChip chip={artwork.whereItIs.chip} /> },
              { label: "Zoho status", value: artwork.catalogueStatus },
            ]}
          />
        </div>
      </div>
      {warning ? (
        <p className="flex items-start gap-2 text-staff-xs text-staff-muted">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{warning}</span>
        </p>
      ) : null}
    </section>
  );
}
