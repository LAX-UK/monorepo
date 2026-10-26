import { STAFF_PARSE_PARAMS } from "@/lib/forms/staff-error-map";
import type { CreateVenueInput, Venue } from "@auction/types";
import { createVenueSchema } from "@auction/validators";
import type { FieldErrors, Resolver } from "react-hook-form";

/** What the venue form holds: every field as the text typed, converted when it is saved. */
export type AdminVenueFormValues = {
  legalEntityId: string;
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  mapUrl: string;
  latitude: string;
  longitude: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  /** One photo web address per line (commas also separate them). */
  photos: string;
  capacity: string;
  accessNotes: string;
  parkingNotes: string;
  directionsNotes: string;
};

export const VENUE_FORM_ID = "venue-form";

/** Field names in the order they appear on the form, which orders the error summary. */
export const VENUE_FIELD_ORDER: readonly (keyof AdminVenueFormValues)[] = [
  "legalEntityId",
  "name",
  "addressLine1",
  "addressLine2",
  "city",
  "county",
  "postcode",
  "country",
  "mapUrl",
  "latitude",
  "longitude",
  "contactPhone",
  "contactEmail",
  "website",
  "capacity",
  "accessNotes",
  "parkingNotes",
  "directionsNotes",
  "photos",
];

function valueOrEmpty(value: string | number | null | undefined): string {
  return value == null ? "" : String(value);
}

export function venueDefaultValues(
  venue: Venue | undefined,
  platformLegalEntityId?: string | null,
): AdminVenueFormValues {
  return {
    legalEntityId: venue?.legalEntityId ?? platformLegalEntityId ?? "",
    name: venue?.name ?? "",
    addressLine1: venue?.addressLine1 ?? "",
    addressLine2: venue?.addressLine2 ?? "",
    city: venue?.city ?? "",
    county: venue?.county ?? "",
    postcode: venue?.postcode ?? "",
    country: venue?.country ?? "United Kingdom",
    mapUrl: venue?.mapUrl ?? "",
    latitude: valueOrEmpty(venue?.latitude),
    longitude: valueOrEmpty(venue?.longitude),
    contactPhone: venue?.contactPhone ?? "",
    contactEmail: venue?.contactEmail ?? "",
    website: venue?.website ?? "",
    photos: venue?.photos.join("\n") ?? "",
    capacity: valueOrEmpty(venue?.capacity),
    accessNotes: venue?.accessNotes ?? "",
    parkingNotes: venue?.parkingNotes ?? "",
    directionsNotes: venue?.directionsNotes ?? "",
  };
}

function photosFromForm(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const MESSAGES: Partial<Record<keyof AdminVenueFormValues, string>> = {
  legalEntityId: "Choose the organisation that runs this venue",
  name: "Enter the venue's name",
  addressLine1: "Enter the first line of the address",
  city: "Enter the city",
  postcode: "Enter a valid UK postcode, like SW1Y 6QU",
  country: "Enter the country",
  capacity: "Enter a whole number of people, like 250",
};

export type ParsedVenue =
  | { ok: true; data: CreateVenueInput }
  | { ok: false; errors: Partial<Record<keyof AdminVenueFormValues, string>> };

/** Checks the typed text against the venue rules and, if it passes, converts it for saving. */
export function parseVenueForm(values: AdminVenueFormValues): ParsedVenue {
  const parsed = createVenueSchema.safeParse(
    {
      legalEntityId: values.legalEntityId.trim(),
      name: values.name,
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2,
      city: values.city,
      county: values.county,
      postcode: values.postcode,
      country: values.country,
      mapUrl: values.mapUrl.trim(),
      latitude: values.latitude.trim(),
      longitude: values.longitude.trim(),
      contactPhone: values.contactPhone,
      contactEmail: values.contactEmail.trim(),
      website: values.website.trim(),
      photos: photosFromForm(values.photos),
      capacity: values.capacity.trim() === "" ? null : values.capacity.trim(),
      accessNotes: values.accessNotes,
      parkingNotes: values.parkingNotes,
      directionsNotes: values.directionsNotes,
    },
    STAFF_PARSE_PARAMS,
  );
  if (parsed.success) return { ok: true, data: parsed.data as CreateVenueInput };
  const errors: Partial<Record<keyof AdminVenueFormValues, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof AdminVenueFormValues | undefined;
    if (!key || errors[key]) continue;
    // A required text field left empty, or an invalid ID, reads better as a plain instruction.
    const generic =
      issue.code === "too_small" ||
      issue.code === "invalid_string" ||
      (issue.code === "invalid_type" && issue.received === "undefined");
    errors[key] = (generic && MESSAGES[key]) || issue.message;
  }
  return { ok: false, errors };
}

/** Validates the venue form with the venue rules, so each problem lands on its own field. */
export const venueResolver: Resolver<AdminVenueFormValues> = async (values) => {
  const parsed = parseVenueForm(values);
  if (parsed.ok) return { values, errors: {} };
  const errors: FieldErrors<AdminVenueFormValues> = {};
  for (const [name, message] of Object.entries(parsed.errors)) {
    errors[name as keyof AdminVenueFormValues] = { type: "validation", message };
  }
  return { values: {}, errors };
};
