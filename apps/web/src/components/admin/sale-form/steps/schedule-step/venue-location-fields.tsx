import {
  StaffEntityField,
  StaffTextAreaField,
  StaffTextField,
} from "@/components/admin/forms/staff-form-fields";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { FieldRow, Notice, StaffButtonLink } from "@auction/staff-ui";
import type { Venue } from "@auction/types";
import { normalizeUkPostcode } from "@auction/validators";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { UseFormReturn } from "react-hook-form";
import { SALE_FORM_ID } from "../../sale-form-id";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  venues: readonly Venue[];
  formattedPreviewAddress: string;
  previewMapUrl: string | null;
  customMapUrl: string | undefined;
  postcodeIsValid: boolean;
};

/**
 * Where the saleroom is: a saved venue fills the address, or the address is typed for a one-off
 * venue. Shown on the public sale page; the map link is made from the address unless one is given.
 */
export function VenueLocationFields({
  form,
  isDraft,
  venues,
  formattedPreviewAddress,
  previewMapUrl,
  customMapUrl,
}: Props) {
  const f = { control: form.control, formId: SALE_FORM_ID } as const;
  const set = (name: Parameters<typeof form.setValue>[0], value: string) =>
    form.setValue(name, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });

  function applyVenue(venue: Venue) {
    set("locationName", venue.name);
    set("locationAddressLine1", venue.addressLine1);
    set("locationAddressLine2", venue.addressLine2 ?? "");
    set("locationCity", venue.city);
    set("locationCounty", venue.county ?? "");
    set("locationPostcode", venue.postcode);
    set("locationCountry", venue.country);
    set("locationMapUrl", venue.mapUrl ?? "");
  }

  const mapHref = customMapUrl?.trim() || previewMapUrl;

  return (
    <>
      <StaffEntityField
        {...f}
        name="venueId"
        label="Saved venue"
        optional
        disabled={!isDraft || venues.length === 0}
        description={
          venues.length === 0
            ? "No saved venues yet. Add one under Venues to reuse its address."
            : "Fills in the address below. Leave empty for a one-off venue."
        }
        options={venues.map((venue) => ({
          id: venue.id,
          label: venue.name,
          description: venue.city,
        }))}
        placeholder="One-off venue"
        searchPlaceholder="Search venues"
        emptyText="No venues match."
        onChanged={(option) => {
          const venue = option ? venues.find((item) => item.id === option.id) : null;
          if (venue) applyVenue(venue);
        }}
      />
      <StaffTextField
        {...f}
        name="locationName"
        label="Venue name"
        placeholder="e.g. The Bond Street rooms"
      />
      <StaffTextField
        {...f}
        name="locationAddressLine1"
        label="Address line 1"
        placeholder="34 New Bond Street"
      />
      <StaffTextField {...f} name="locationAddressLine2" label="Address line 2" optional />
      <FieldRow>
        <StaffTextField {...f} name="locationCity" label="Town or city" placeholder="London" />
        <StaffTextField {...f} name="locationCounty" label="County" optional />
      </FieldRow>
      <FieldRow>
        <StaffTextField
          {...f}
          name="locationPostcode"
          label="Postcode"
          placeholder="SW1Y 6QU"
          tidyOnBlur={normalizeUkPostcode}
        />
        <StaffTextField
          {...f}
          name="locationCountry"
          label="Country"
          placeholder="United Kingdom"
        />
      </FieldRow>
      <StaffTextAreaField
        {...f}
        name="locationAddress"
        label="Address as written"
        optional
        rows={2}
        description="Shown only when the fields above are empty."
      />
      <StaffTextField
        {...f}
        name="locationMapUrl"
        label="Map link"
        optional
        placeholder="https://maps.google.com/…"
        description="Leave empty to link to Google Maps from the address."
      />
      {formattedPreviewAddress || mapHref ? (
        <Notice
          tone="info"
          title="On the sale page"
          actions={
            mapHref ? (
              <StaffButtonLink
                size="sm"
                variant="secondary"
                icon={<ExternalLink aria-hidden />}
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                Link={Link}
              >
                Open map
              </StaffButtonLink>
            ) : null
          }
        >
          {formattedPreviewAddress || "The address appears here as you type it."}
        </Notice>
      ) : null}
    </>
  );
}
