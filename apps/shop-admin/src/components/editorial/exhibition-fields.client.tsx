"use client";

import {
  EditorialCheckbox,
  EditorialSelectField,
  EditorialTextArea,
  EditorialTextField,
  type EntityFieldsProps,
  FieldSection,
  SlugField,
  editorialFieldId,
} from "@/components/editorial/editorial-field-parts.client";
import { EditorialImageField } from "@/components/editorial/editorial-image-field.client";
import {
  EXHIBITION_KINDS,
  type EditorialAdminRow,
  type ExhibitionForm,
} from "@/lib/editorial-entity-forms";
import { EDITORIAL_EXHIBITION_KIND_LABELS } from "@/server/domain/editorial-list.vm";
import { DateInput, EnumSelect, Field, FieldRow } from "@auction/staff-ui";

const NO_VENUE = "none";

/** A venue the exhibition points at, even when it has since been removed from the list. */
function venueOptions(venues: readonly EditorialAdminRow[], selected: string) {
  const options = [
    { value: NO_VENUE, label: "No venue" },
    ...venues.map((venue) => ({
      value: venue.id,
      label: `${venue.label}${venue.status === "draft" ? " (draft)" : ""}`,
    })),
  ];
  if (selected && !venues.some((venue) => venue.id === selected)) {
    options.push({ value: selected, label: "Venue no longer available" });
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
      <FieldSection title="Details" description="What it is and how it reads on lax.art.">
        <SlugField
          value={form.slug}
          error={errors.slug}
          disabled={disabled}
          onChange={(value) => set("slug", value)}
        />
        <EditorialSelectField
          name="kind"
          label="Kind"
          value={form.kind}
          error={errors.kind}
          disabled={disabled}
          options={EXHIBITION_KINDS.map((kind) => ({
            value: kind,
            label: EDITORIAL_EXHIBITION_KIND_LABELS[kind] ?? kind,
          }))}
          onValueChange={(value) => set("kind", value)}
        />
        <EditorialTextField
          name="title"
          label="Title"
          value={form.title}
          error={errors.title}
          maxLength={300}
          disabled={disabled}
          onChange={(value) => set("title", value)}
        />
        <EditorialTextField
          name="subtitle"
          label="Subtitle"
          optional
          value={form.subtitle}
          error={errors.subtitle}
          maxLength={300}
          disabled={disabled}
          onChange={(value) => set("subtitle", value)}
        />
        <EditorialTextArea
          name="summary"
          label="Summary"
          optional
          value={form.summary}
          error={errors.summary}
          maxLength={2000}
          disabled={disabled}
          onChange={(value) => set("summary", value)}
        />
        <EditorialCheckbox
          name="featured"
          label="Featured on lax.art"
          checked={form.featured}
          disabled={disabled}
          onChange={(value) => set("featured", value)}
        />
      </FieldSection>

      <FieldSection title="Where and when" description="The venue and the dates it runs.">
        <Field
          label="Venue"
          optional
          id={editorialFieldId("venueId")}
          error={errors.venueId}
          disabled={disabled}
        >
          <EnumSelect
            value={form.venueId || NO_VENUE}
            onValueChange={(value) => set("venueId", value === NO_VENUE ? "" : value)}
            options={venueOptions(venues, form.venueId)}
          />
        </Field>
        <FieldRow>
          <Field
            label="Starts on"
            optional
            id={editorialFieldId("startsOn")}
            error={errors.startsOn}
            disabled={disabled}
          >
            <DateInput
              value={form.startsOn || null}
              onValueChange={(day) => set("startsOn", day ?? "")}
            />
          </Field>
          <Field
            label="Ends on"
            optional
            id={editorialFieldId("endsOn")}
            error={errors.endsOn}
            disabled={disabled}
          >
            <DateInput
              value={form.endsOn || null}
              onValueChange={(day) => set("endsOn", day ?? "")}
            />
          </Field>
        </FieldRow>
        <EditorialTextField
          name="timesNote"
          label="Times note"
          optional
          description="For example: Late opening Thursdays until 21:00."
          value={form.timesNote}
          error={errors.timesNote}
          maxLength={500}
          disabled={disabled}
          onChange={(value) => set("timesNote", value)}
        />
      </FieldSection>

      <FieldSection
        title="Exhibition contact"
        description="Shown on the exhibition page for visitors who want to get in touch. Leave blank for none."
      >
        <FieldRow>
          <EditorialTextField
            name="contactName"
            label="Name"
            optional
            value={form.contactName}
            error={errors.contactName}
            maxLength={200}
            disabled={disabled}
            onChange={(value) => set("contactName", value)}
          />
          <EditorialTextField
            name="contactRole"
            label="Role"
            optional
            value={form.contactRole}
            error={errors.contactRole}
            maxLength={200}
            disabled={disabled}
            onChange={(value) => set("contactRole", value)}
          />
        </FieldRow>
        <FieldRow>
          <EditorialTextField
            name="contactEmail"
            label="Email"
            optional
            type="email"
            value={form.contactEmail}
            error={errors.contactEmail}
            maxLength={254}
            disabled={disabled}
            onChange={(value) => set("contactEmail", value)}
          />
          <EditorialTextField
            name="contactPhone"
            label="Phone"
            optional
            type="tel"
            value={form.contactPhone}
            error={errors.contactPhone}
            maxLength={64}
            disabled={disabled}
            onChange={(value) => set("contactPhone", value)}
          />
        </FieldRow>
        <EditorialImageField
          name="contactAvatarMediaKey"
          label="Contact photo"
          kind="editorial_inline"
          value={form.contactAvatarMediaKey}
          disabled={disabled}
          onChange={(key) => set("contactAvatarMediaKey", key)}
        />
      </FieldSection>

      <FieldSection title="Cover image" description="Leads the exhibition page and its cards.">
        <EditorialImageField
          name="coverMediaKey"
          label="Cover image"
          kind="editorial_cover"
          value={form.coverMediaKey}
          disabled={disabled}
          onChange={(key) => set("coverMediaKey", key)}
        />
      </FieldSection>
    </>
  );
}
