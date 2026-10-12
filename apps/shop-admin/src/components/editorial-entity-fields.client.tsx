"use client";

import {
  EditorialCheckbox,
  EditorialSelect,
  EditorialTextArea,
  EditorialTextField,
} from "@/components/editorial-form-controls";
import { MediaUploadField } from "@/components/media-upload-field";
import {
  EXHIBITION_KINDS,
  type EditorialAdminRow,
  type ExhibitionForm,
  type PageForm,
  STORY_KINDS,
  type StoryForm,
  type VenueForm,
} from "@/lib/editorial-entity-forms";

export type EntityFieldsProps<F> = {
  form: F;
  onChange: (next: F) => void;
  disabled: boolean;
};

const SLUG_HINT = "Lowercase letters, numbers and single hyphens, e.g. summer-show-2026.";

function SlugField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <EditorialTextField
      label="Slug"
      hint={SLUG_HINT}
      value={value}
      maxLength={120}
      required
      disabled={disabled}
      onChange={onChange}
    />
  );
}

export function PageFields({ form, onChange, disabled }: EntityFieldsProps<PageForm>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SlugField
        value={form.slug}
        disabled={disabled}
        onChange={(slug) => onChange({ ...form, slug })}
      />
      <EditorialTextField
        label="Title"
        value={form.title}
        maxLength={300}
        required
        disabled={disabled}
        onChange={(title) => onChange({ ...form, title })}
      />
    </div>
  );
}

export function VenueFields({ form, onChange, disabled }: EntityFieldsProps<VenueForm>) {
  const set = <K extends keyof VenueForm>(key: K, value: VenueForm[K]) =>
    onChange({ ...form, [key]: value });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <SlugField value={form.slug} disabled={disabled} onChange={(v) => set("slug", v)} />
        <EditorialTextField
          label="Name"
          value={form.name}
          maxLength={300}
          required
          disabled={disabled}
          onChange={(v) => set("name", v)}
        />
        <EditorialTextField
          label="Address"
          value={form.address}
          maxLength={500}
          disabled={disabled}
          onChange={(v) => set("address", v)}
        />
        <EditorialTextField
          label="Postcode"
          value={form.postcode}
          maxLength={32}
          disabled={disabled}
          onChange={(v) => set("postcode", v)}
        />
        <EditorialTextField
          label="Phone"
          type="tel"
          value={form.phone}
          maxLength={64}
          disabled={disabled}
          onChange={(v) => set("phone", v)}
        />
        <EditorialTextField
          label="Email"
          type="email"
          value={form.email}
          maxLength={254}
          disabled={disabled}
          onChange={(v) => set("email", v)}
        />
        <div className="sm:col-span-2">
          <EditorialTextField
            label="Map URL"
            type="url"
            hint="Must start with https://"
            value={form.mapUrl}
            maxLength={2048}
            disabled={disabled}
            onChange={(v) => set("mapUrl", v)}
          />
        </div>
      </div>
      <EditorialTextArea
        label="Opening hours (JSON, optional)"
        hint='A list keeps your order, e.g. [{"label":"Tue – Sat","hours":"10:00 – 18:00"},{"label":"Sun","hours":"Closed"}]'
        rows={3}
        monospace
        value={form.openingHoursJson}
        disabled={disabled}
        onChange={(v) => set("openingHoursJson", v)}
      />
      <MediaUploadField
        kind="venue_image"
        label="Cover image"
        value={form.coverMediaKey}
        disabled={disabled}
        onChange={(key) => set("coverMediaKey", key)}
      />
    </div>
  );
}

export function StoryFields({ form, onChange, disabled }: EntityFieldsProps<StoryForm>) {
  const set = <K extends keyof StoryForm>(key: K, value: StoryForm[K]) =>
    onChange({ ...form, [key]: value });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <SlugField value={form.slug} disabled={disabled} onChange={(v) => set("slug", v)} />
        <EditorialSelect
          label="Kind"
          value={form.kind}
          options={STORY_KINDS.map((kind) => ({ value: kind, label: kind }))}
          disabled={disabled}
          onChange={(v) => set("kind", v)}
        />
        <div className="sm:col-span-2">
          <EditorialTextField
            label="Title"
            value={form.title}
            maxLength={300}
            required
            disabled={disabled}
            onChange={(v) => set("title", v)}
          />
        </div>
      </div>
      <EditorialTextArea
        label="Standfirst (optional)"
        value={form.standfirst}
        maxLength={2000}
        disabled={disabled}
        onChange={(v) => set("standfirst", v)}
      />
      <EditorialTextField
        label="Video URL (optional)"
        type="url"
        hint="Must start with https://"
        value={form.videoUrl}
        maxLength={2048}
        disabled={disabled}
        onChange={(v) => set("videoUrl", v)}
      />
      <EditorialCheckbox
        label="Featured"
        checked={form.featured}
        disabled={disabled}
        onChange={(v) => set("featured", v)}
      />
      <MediaUploadField
        kind="editorial_cover"
        label="Cover image"
        value={form.coverMediaKey}
        disabled={disabled}
        onChange={(key) => set("coverMediaKey", key)}
      />
    </div>
  );
}

export function ExhibitionFields({
  form,
  onChange,
  disabled,
  venues,
}: EntityFieldsProps<ExhibitionForm> & { venues: readonly EditorialAdminRow[] }) {
  const set = <K extends keyof ExhibitionForm>(key: K, value: ExhibitionForm[K]) =>
    onChange({ ...form, [key]: value });
  const venueOptions = [
    { value: "", label: "No venue" },
    ...venues.map((venue) => ({
      value: venue.id,
      label: `${venue.label}${venue.status === "draft" ? " (draft)" : ""}`,
    })),
  ];
  if (form.venueId && !venues.some((venue) => venue.id === form.venueId)) {
    venueOptions.push({ value: form.venueId, label: "Unknown venue (removed?)" });
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <SlugField value={form.slug} disabled={disabled} onChange={(v) => set("slug", v)} />
        <EditorialSelect
          label="Kind"
          value={form.kind}
          options={EXHIBITION_KINDS.map((kind) => ({ value: kind, label: kind }))}
          disabled={disabled}
          onChange={(v) => set("kind", v)}
        />
        <div className="sm:col-span-2">
          <EditorialTextField
            label="Title"
            value={form.title}
            maxLength={300}
            required
            disabled={disabled}
            onChange={(v) => set("title", v)}
          />
        </div>
        <EditorialSelect
          label="Venue"
          value={form.venueId}
          options={venueOptions}
          disabled={disabled}
          onChange={(v) => set("venueId", v)}
        />
        <EditorialTextField
          label="Times note (optional)"
          hint="e.g. Late opening Thursdays until 21:00"
          value={form.timesNote}
          maxLength={500}
          disabled={disabled}
          onChange={(v) => set("timesNote", v)}
        />
        <EditorialTextField
          label="Starts on"
          type="date"
          value={form.startsOn}
          disabled={disabled}
          onChange={(v) => set("startsOn", v)}
        />
        <EditorialTextField
          label="Ends on"
          type="date"
          value={form.endsOn}
          disabled={disabled}
          onChange={(v) => set("endsOn", v)}
        />
      </div>
      <EditorialTextArea
        label="Summary (optional)"
        value={form.summary}
        maxLength={2000}
        disabled={disabled}
        onChange={(v) => set("summary", v)}
      />
      <EditorialCheckbox
        label="Featured"
        checked={form.featured}
        disabled={disabled}
        onChange={(v) => set("featured", v)}
      />
      <MediaUploadField
        kind="editorial_cover"
        label="Cover image"
        value={form.coverMediaKey}
        disabled={disabled}
        onChange={(key) => set("coverMediaKey", key)}
      />
    </div>
  );
}
