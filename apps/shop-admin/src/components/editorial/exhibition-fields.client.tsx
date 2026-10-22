"use client";

import {
  type EntityFieldsProps,
  FieldSection,
  SlugField,
} from "@/components/editorial/editorial-field-parts.client";
import {
  CheckboxField,
  DateField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/forms/fields";
import { MediaUploadField } from "@/components/media-upload-field";
import {
  EXHIBITION_KINDS,
  type EditorialAdminRow,
  type ExhibitionForm,
} from "@/lib/editorial-entity-forms";

const KIND_LABELS: Record<(typeof EXHIBITION_KINDS)[number], string> = {
  exhibition: "Exhibition",
  film: "Film",
  event: "Event",
};

/** A venue the exhibition points at, even when it has since been removed from the list. */
function venueOptions(venues: readonly EditorialAdminRow[], selected: string) {
  const options = [
    { value: "", label: "No venue" },
    ...venues.map((venue) => ({
      value: venue.id,
      label: `${venue.label}${venue.status === "draft" ? " (draft)" : ""}`,
    })),
  ];
  if (selected && !venues.some((venue) => venue.id === selected)) {
    options.push({ value: selected, label: "Unknown venue (removed?)" });
  }
  return options;
}

export function ExhibitionFields({
  form,
  onChange,
  disabled,
  errors,
  venues,
}: EntityFieldsProps<ExhibitionForm> & { venues: readonly EditorialAdminRow[] }) {
  const set = <K extends keyof ExhibitionForm>(key: K, value: ExhibitionForm[K]) =>
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
        <SelectField
          name="kind"
          label="Kind"
          value={form.kind}
          options={EXHIBITION_KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] }))}
          disabled={disabled}
          onChange={(value) => set("kind", value)}
        />
        <TextField
          name="title"
          label="Title"
          className="sm:col-span-2"
          value={form.title}
          error={errors.title}
          maxLength={300}
          required
          disabled={disabled}
          onChange={(value) => set("title", value)}
        />
        <TextField
          name="subtitle"
          label="Subtitle (optional)"
          className="sm:col-span-2"
          value={form.subtitle}
          error={errors.subtitle}
          maxLength={300}
          disabled={disabled}
          onChange={(value) => set("subtitle", value)}
        />
        <TextAreaField
          name="summary"
          label="Summary (optional)"
          className="sm:col-span-2"
          value={form.summary}
          error={errors.summary}
          maxLength={2000}
          disabled={disabled}
          onChange={(value) => set("summary", value)}
        />
        <CheckboxField
          name="featured"
          label="Featured on lax.art"
          checked={form.featured}
          disabled={disabled}
          onChange={(value) => set("featured", value)}
        />
      </FieldSection>

      <FieldSection title="Where and when">
        <SelectField
          name="venueId"
          label="Venue"
          value={form.venueId}
          error={errors.venueId}
          options={venueOptions(venues, form.venueId)}
          disabled={disabled}
          onChange={(value) => set("venueId", value)}
        />
        <TextField
          name="timesNote"
          label="Times note (optional)"
          hint="e.g. Late opening Thursdays until 21:00"
          value={form.timesNote}
          error={errors.timesNote}
          maxLength={500}
          disabled={disabled}
          onChange={(value) => set("timesNote", value)}
        />
        <DateField
          name="startsOn"
          label="Starts on"
          value={form.startsOn}
          error={errors.startsOn}
          disabled={disabled}
          onChange={(value) => set("startsOn", value)}
        />
        <DateField
          name="endsOn"
          label="Ends on"
          value={form.endsOn}
          error={errors.endsOn}
          disabled={disabled}
          onChange={(value) => set("endsOn", value)}
        />
      </FieldSection>

      <FieldSection
        title="Exhibition contact"
        description="Shown on the exhibition page for visitors who want to get in touch. Leave blank for none."
      >
        <TextField
          name="contactName"
          label="Name"
          value={form.contactName}
          error={errors.contactName}
          maxLength={200}
          autoComplete="off"
          disabled={disabled}
          onChange={(value) => set("contactName", value)}
        />
        <TextField
          name="contactRole"
          label="Role"
          value={form.contactRole}
          error={errors.contactRole}
          maxLength={200}
          disabled={disabled}
          onChange={(value) => set("contactRole", value)}
        />
        <TextField
          name="contactEmail"
          label="Email"
          type="email"
          value={form.contactEmail}
          error={errors.contactEmail}
          maxLength={254}
          autoComplete="off"
          disabled={disabled}
          onChange={(value) => set("contactEmail", value)}
        />
        <TextField
          name="contactPhone"
          label="Phone"
          type="tel"
          value={form.contactPhone}
          error={errors.contactPhone}
          maxLength={64}
          autoComplete="off"
          disabled={disabled}
          onChange={(value) => set("contactPhone", value)}
        />
        <div className="sm:col-span-2">
          <MediaUploadField
            kind="editorial_inline"
            label="Contact photo"
            value={form.contactAvatarMediaKey}
            disabled={disabled}
            onChange={(key) => set("contactAvatarMediaKey", key)}
          />
        </div>
      </FieldSection>

      <FieldSection title="Cover image">
        <div className="sm:col-span-2">
          <MediaUploadField
            kind="editorial_cover"
            label="Cover image"
            value={form.coverMediaKey}
            disabled={disabled}
            onChange={(key) => set("coverMediaKey", key)}
          />
        </div>
      </FieldSection>
    </>
  );
}
