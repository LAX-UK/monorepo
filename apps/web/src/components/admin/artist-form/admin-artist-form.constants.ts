import type { ArtistFormValues } from "@/components/admin/artist-form/types";
import type { ArtistStatus } from "@auction/types";

/** The artist form's id: prefixes every control's id so the error summary can link to them. */
export const ARTIST_FORM_ID = "artist-form";

/** Catalogue status choices on the form; a merged profile is read-only and not offered. */
export const ARTIST_STATUS_OPTIONS: ReadonlyArray<{
  value: Exclude<ArtistStatus, "merged_into">;
  label: string;
  description: string;
}> = [
  {
    value: "approved",
    label: "Approved",
    description: "Listed in the public directory and available for attribution.",
  },
  {
    value: "pending",
    label: "Pending review",
    description: "Hidden until reviewed. Lots attributed to it are flagged for review.",
  },
  {
    value: "rejected",
    label: "Rejected",
    description: "Hidden, and not available for attribution.",
  },
];

/** Field names in the order they appear on the form, which orders the error summary. */
export const ARTIST_FIELD_ORDER: readonly (keyof ArtistFormValues)[] = [
  "kind",
  "displayName",
  "nationality",
  "location",
  "birthYear",
  "deathYear",
  "foundedYear",
  "dissolvedYear",
  "countryCode",
  "shortBio",
  "longBio",
  "statement",
  "portraitUrl",
  "heroImageUrl",
  "websiteUrl",
  "categoryIds",
  "attributes",
  "ownerUserId",
  "status",
  "featured",
  "verified",
  "archived",
];
