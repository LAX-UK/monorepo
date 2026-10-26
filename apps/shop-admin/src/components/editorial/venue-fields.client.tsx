"use client";

import {
  EditorialTextField,
  type EntityFieldsProps,
  FieldSection,
  SlugField,
} from "@/components/editorial/editorial-field-parts.client";
import { EditorialImageField } from "@/components/editorial/editorial-image-field.client";
import { OpeningHoursEditor } from "@/components/editorial/opening-hours-editor.client";
import type { VenueForm } from "@/lib/editorial-entity-forms";
import { FieldRow } from "@auction/staff-ui";

export function VenueFields({ form, onChange, disabled, errors }: EntityFieldsProps<VenueForm>) {
  const set = <K extends keyof VenueForm>(key: K, value: VenueForm[K]) =>
    onChange({ ...form, [key]: value });
  return (
    <>
      <FieldSection title="Details" description="The venue's name, address on lax.art and picture.">
        <EditorialTextField
          name="name"
          label="Name"
          value={form.name}
          error={errors.name}
          maxLength={300}
          disabled={disabled}
          onChange={(value) => set("name", value)}
        />
        <SlugField
          value={form.slug}
          error={errors.slug}
          disabled={disabled}
          onChange={(value) => set("slug", value)}
        />
        <EditorialImageField
          name="coverMediaKey"
          label="Cover image"
          kind="venue_image"
          value={form.coverMediaKey}
          disabled={disabled}
          onChange={(key) => set("coverMediaKey", key)}
        />
      </FieldSection>

      <FieldSection title="Address and map" description="Where visitors find the venue.">
        <EditorialTextField
          name="address"
          label="Full address"
          optional
          value={form.address}
          error={errors.address}
          maxLength={500}
          disabled={disabled}
          onChange={(value) => set("address", value)}
        />
        <EditorialTextField
          name="streetLine"
          label="Street line"
          optional
          description="The short address line on venue cards."
          value={form.streetLine}
          error={errors.streetLine}
          maxLength={300}
          disabled={disabled}
          onChange={(value) => set("streetLine", value)}
        />
        <FieldRow>
          <EditorialTextField
            name="city"
            label="City"
            optional
            value={form.city}
            error={errors.city}
            maxLength={120}
            disabled={disabled}
            onChange={(value) => set("city", value)}
          />
          <EditorialTextField
            name="postcode"
            label="Postcode"
            optional
            value={form.postcode}
            error={errors.postcode}
            maxLength={32}
            disabled={disabled}
            onChange={(value) => set("postcode", value)}
          />
        </FieldRow>
        <EditorialTextField
          name="mapUrl"
          label="Map URL"
          optional
          type="url"
          description="It must start with https://"
          value={form.mapUrl}
          error={errors.mapUrl}
          maxLength={2048}
          disabled={disabled}
          onChange={(value) => set("mapUrl", value)}
        />
        <FieldRow>
          <EditorialTextField
            name="latitude"
            label="Latitude"
            optional
            inputMode="decimal"
            description="Between -90 and 90, such as 51.5203. Enter with longitude to place the map pin."
            value={form.latitude}
            error={errors.latitude}
            disabled={disabled}
            onChange={(value) => set("latitude", value)}
          />
          <EditorialTextField
            name="longitude"
            label="Longitude"
            optional
            inputMode="decimal"
            description="Between -180 and 180, such as -0.1532."
            value={form.longitude}
            error={errors.longitude}
            disabled={disabled}
            onChange={(value) => set("longitude", value)}
          />
        </FieldRow>
      </FieldSection>

      <FieldSection title="Contact" description="How visitors reach the venue.">
        <FieldRow>
          <EditorialTextField
            name="phone"
            label="Phone"
            optional
            type="tel"
            value={form.phone}
            error={errors.phone}
            maxLength={64}
            disabled={disabled}
            onChange={(value) => set("phone", value)}
          />
          <EditorialTextField
            name="email"
            label="Email"
            optional
            type="email"
            value={form.email}
            error={errors.email}
            maxLength={254}
            disabled={disabled}
            onChange={(value) => set("email", value)}
          />
        </FieldRow>
      </FieldSection>

      <FieldSection
        title="Opening hours"
        description="Days with the same hours are shown as one line on lax.art."
      >
        <OpeningHoursEditor
          value={form.openingHours}
          error={errors.openingHours}
          disabled={disabled}
          onChange={(openingHours) => set("openingHours", openingHours)}
        />
      </FieldSection>
    </>
  );
}
