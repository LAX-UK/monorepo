"use client";

import {
  type EntityFieldsProps,
  FieldSection,
  SlugField,
} from "@/components/editorial/editorial-field-parts.client";
import { OpeningHoursEditor } from "@/components/editorial/opening-hours-editor.client";
import { TextField } from "@/components/forms/fields";
import { MediaUploadField } from "@/components/media-upload-field";
import type { VenueForm } from "@/lib/editorial-entity-forms";

export function VenueFields({ form, onChange, disabled, errors }: EntityFieldsProps<VenueForm>) {
  const set = <K extends keyof VenueForm>(key: K, value: VenueForm[K]) =>
    onChange({ ...form, [key]: value });
  return (
    <>
      <FieldSection title="Details">
        <SlugField
          value={form.slug}
          error={errors.slug}
          disabled={disabled}
          onChange={(value) => set("slug", value)}
        />
        <TextField
          name="name"
          label="Name"
          value={form.name}
          error={errors.name}
          maxLength={300}
          required
          disabled={disabled}
          onChange={(value) => set("name", value)}
        />
        <div className="sm:col-span-2">
          <MediaUploadField
            kind="venue_image"
            label="Cover image"
            value={form.coverMediaKey}
            disabled={disabled}
            onChange={(key) => set("coverMediaKey", key)}
          />
        </div>
      </FieldSection>

      <FieldSection title="Address and map">
        <TextField
          name="address"
          label="Full address (optional)"
          className="sm:col-span-2"
          value={form.address}
          error={errors.address}
          maxLength={500}
          disabled={disabled}
          onChange={(value) => set("address", value)}
        />
        <TextField
          name="streetLine"
          label="Street line (optional)"
          hint="The short address line on venue cards."
          value={form.streetLine}
          error={errors.streetLine}
          maxLength={300}
          disabled={disabled}
          onChange={(value) => set("streetLine", value)}
        />
        <TextField
          name="city"
          label="City (optional)"
          value={form.city}
          error={errors.city}
          maxLength={120}
          disabled={disabled}
          onChange={(value) => set("city", value)}
        />
        <TextField
          name="postcode"
          label="Postcode (optional)"
          value={form.postcode}
          error={errors.postcode}
          maxLength={32}
          disabled={disabled}
          onChange={(value) => set("postcode", value)}
        />
        <TextField
          name="mapUrl"
          label="Map link (optional)"
          type="url"
          hint="Must start with https://"
          value={form.mapUrl}
          error={errors.mapUrl}
          maxLength={2048}
          disabled={disabled}
          onChange={(value) => set("mapUrl", value)}
        />
        <TextField
          name="latitude"
          label="Latitude (optional)"
          hint="Between -90 and 90, e.g. 51.5203. Enter with longitude to place the map pin."
          value={form.latitude}
          error={errors.latitude}
          disabled={disabled}
          onChange={(value) => set("latitude", value)}
        />
        <TextField
          name="longitude"
          label="Longitude (optional)"
          hint="Between -180 and 180, e.g. -0.1532"
          value={form.longitude}
          error={errors.longitude}
          disabled={disabled}
          onChange={(value) => set("longitude", value)}
        />
      </FieldSection>

      <FieldSection title="Contact and opening hours">
        <TextField
          name="phone"
          label="Phone (optional)"
          type="tel"
          value={form.phone}
          error={errors.phone}
          maxLength={64}
          disabled={disabled}
          onChange={(value) => set("phone", value)}
        />
        <TextField
          name="email"
          label="Email (optional)"
          type="email"
          value={form.email}
          error={errors.email}
          maxLength={254}
          disabled={disabled}
          onChange={(value) => set("email", value)}
        />
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
