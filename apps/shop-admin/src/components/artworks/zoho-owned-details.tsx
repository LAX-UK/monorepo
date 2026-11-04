import { ArtworkThumbnail } from "@/components/artworks/artwork-thumbnail";
import type { ArtworkFormImage } from "@/lib/artwork-form";
import {
  EmptyState,
  FieldRow,
  FormSection,
  KeyValueList,
  SourceMark,
  SourcedField,
  StaffButton,
  StatusBadge,
} from "@auction/staff-ui";
import { ExternalLink, Lock } from "@auction/staff-ui/icons";
import type * as React from "react";

const SOURCE = "From Zoho";

/** The Zoho values of a linked artwork, as the page shows them. */
export type ZohoOwnedValues = {
  title: string;
  artistName: string;
  yearCreated: string;
  medium: string;
  dimensions: string;
  slug: string;
};

function EditInZoho({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <StaffButton asChild variant="secondary" size="sm" icon={<ExternalLink aria-hidden />}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        Edit in Zoho
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </StaffButton>
  );
}

/**
 * The part of a linked lax.art artwork that Zoho owns: title, artist, year, medium and size. Each
 * value is marked "From Zoho" and is not an input, because a change in Zoho reaches this page
 * within seconds. The web address is LAX's, and fixed once the artwork is published. LAX's own
 * fields (description, how it is sold, search listing) follow as ordinary inputs in `children`.
 */
export function ZohoOwnedDetails({
  values,
  zohoUrl,
  children,
}: {
  values: ZohoOwnedValues;
  zohoUrl: string | null;
  children: React.ReactNode;
}) {
  return (
    <FormSection
      title="Details"
      description="What the work is comes from Zoho. Write about it for lax.art buyers below."
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-staff-sm text-staff-muted">
          <Lock aria-hidden className="size-3.5" />
          Edited in Zoho and kept up to date here.
        </p>
        <EditInZoho href={zohoUrl} />
      </div>
      <SourcedField label="Title" source={SOURCE}>
        {values.title}
      </SourcedField>
      <FieldRow>
        <SourcedField label="Artist" source={SOURCE}>
          {values.artistName}
        </SourcedField>
        <SourcedField label="Year" source={SOURCE} emptyText="Not in Zoho yet">
          {values.yearCreated}
        </SourcedField>
      </FieldRow>
      <FieldRow>
        <SourcedField label="Medium" source={SOURCE} emptyText="Not in Zoho yet">
          {values.medium}
        </SourcedField>
        <SourcedField label="Dimensions" source={SOURCE} emptyText="Not in Zoho yet">
          {values.dimensions}
        </SourcedField>
      </FieldRow>
      <KeyValueList
        items={[
          {
            label: "Web address",
            value: `/artworks/${values.slug}`,
            copyValue: values.slug,
          },
        ]}
      />
      {children}
    </FormSection>
  );
}

/** The images Zoho holds for the artwork, in Zoho's order. Nothing to upload or reorder here. */
export function ZohoOwnedMedia({
  images,
}: {
  images: ReadonlyArray<ArtworkFormImage>;
}) {
  return (
    <FormSection title="Media" description="From Zoho, in Zoho's order. The first is the cover.">
      {images.length === 0 ? (
        <EmptyState
          size="compact"
          headingLevel="h3"
          illustration="frame"
          title="No images in Zoho yet"
          description="Add an image in Zoho. It arrives here by itself."
        />
      ) : (
        <ol aria-label="Images, in display order" className="flex flex-wrap gap-3">
          {images.map((image, index) => (
            <li key={image.mediaKey} className="flex flex-col gap-1.5">
              <ArtworkThumbnail url={image.url} size="md" />
              {index === 0 ? (
                <StatusBadge tone="info" className="self-start">
                  Cover
                </StatusBadge>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <p className="flex items-center gap-1.5 text-staff-xs text-staff-muted">
        <SourceMark source={SOURCE} />
        <span>Add or reorder images in Zoho. They arrive here by themselves.</span>
      </p>
    </FormSection>
  );
}
