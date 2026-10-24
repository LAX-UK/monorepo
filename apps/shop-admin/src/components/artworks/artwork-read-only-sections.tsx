import { ArtworkThumbnail } from "@/components/artworks/artwork-thumbnail";
import type { ArtworkFormValues } from "@/lib/artwork-form";
import type { AdminArtworkDetail } from "@auction/shop-contracts";
import { FormSection, KeyValueList, StatusBadge } from "@auction/staff-ui";

/*
 * What staff without catalogue access see in place of the editor's inputs: the stored values as
 * facts, in the same sections and order, so nothing reads as a broken or disabled control.
 */

const or = (value: string, fallback = "—") => value.trim() || fallback;

export function ReadOnlyDetails({
  values,
  record,
}: {
  values: ArtworkFormValues;
  record: AdminArtworkDetail;
}) {
  return (
    <FormSection
      title="Details"
      description="What the work is and who made it, as shown on its storefront page."
    >
      <KeyValueList
        items={[
          { label: "Title", value: values.title },
          { label: "Web address", value: `/artworks/${record.slug}`, copyValue: record.slug },
          { label: "Artist", value: values.artistName ?? record.artist.displayName },
          { label: "Year", value: or(values.yearCreated) },
          { label: "Medium", value: or(values.medium) },
          { label: "Dimensions", value: or(values.dimensions) },
          {
            label: "Description",
            value: <span className="whitespace-pre-line">{or(values.description)}</span>,
          },
        ]}
      />
    </FormSection>
  );
}

export function ReadOnlyMedia({
  images,
  importedImageUrl,
}: {
  images: ArtworkFormValues["images"];
  importedImageUrl: string | null;
}) {
  return (
    <FormSection
      title="Media"
      description="The first image is the primary one: it leads the gallery and is the thumbnail in lists."
    >
      {images.length === 0 ? (
        importedImageUrl ? (
          <div className="flex items-center gap-3">
            <ArtworkThumbnail url={importedImageUrl} size="md" />
            <span className="text-staff-sm text-staff-muted">Imported image</span>
          </div>
        ) : (
          <p className="text-staff-sm text-staff-muted">No images yet.</p>
        )
      ) : (
        <ol aria-label="Images, in display order" className="grid gap-3 sm:grid-cols-2">
          {images.map((image, index) => (
            <li key={image.mediaKey} className="flex items-center gap-3">
              <ArtworkThumbnail url={image.url} size="md" />
              <div className="flex min-w-0 flex-col gap-1">
                {index === 0 ? (
                  <StatusBadge tone="info" className="self-start">
                    Primary
                  </StatusBadge>
                ) : null}
                <span className="truncate text-staff-sm text-staff-fg">
                  {image.alt.trim() || "No description"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </FormSection>
  );
}

export function ReadOnlySearchListing({ values }: { values: ArtworkFormValues }) {
  return (
    <FormSection
      title="Search listing"
      description="How the page appears in search results. Blank uses the title and description."
    >
      <KeyValueList
        items={[
          { label: "Search title", value: or(values.seoTitle, "Uses the title") },
          { label: "Search description", value: or(values.seoDescription, "Uses the description") },
        ]}
      />
    </FormSection>
  );
}
