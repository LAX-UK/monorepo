"use client";

import {
  type EntityFieldsProps,
  FieldSection,
  SeoSection,
  SlugField,
} from "@/components/editorial/editorial-field-parts.client";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { MediaUploadField } from "@/components/media-upload-field";
import type { StoryForm } from "@/lib/editorial-entity-forms";
import {
  STORY_KINDS,
  STORY_KIND_LABELS,
  type StoryKindField,
  storyCategoryOptions,
  storyKindHasField,
} from "@/lib/editorial-story-kinds";

/** The fields only some kinds use. A field shows when the chosen kind uses it. */
function StoryKindFields({ form, onChange, disabled, errors }: EntityFieldsProps<StoryForm>) {
  const set = <K extends keyof StoryForm>(key: K, value: StoryForm[K]) =>
    onChange({ ...form, [key]: value });
  const has = (field: StoryKindField) => storyKindHasField(form.kind, field);
  const label = STORY_KIND_LABELS[form.kind];

  return (
    <FieldSection title={`${label} details`}>
      {has("series") ? (
        <TextField
          name="series"
          label="Series (optional)"
          value={form.series}
          error={errors.series}
          maxLength={120}
          disabled={disabled}
          onChange={(value) => set("series", value)}
        />
      ) : null}
      {has("episodeNumber") ? (
        <TextField
          name="episodeNumber"
          label="Episode number (optional)"
          type="number"
          min={1}
          value={form.episodeNumber}
          error={errors.episodeNumber}
          disabled={disabled}
          onChange={(value) => set("episodeNumber", value)}
        />
      ) : null}
      {has("audioUrl") ? (
        <TextField
          name="audioUrl"
          label="Audio URL"
          type="url"
          className="sm:col-span-2"
          hint="Link to the episode audio; must start with https://"
          value={form.audioUrl}
          error={errors.audioUrl}
          maxLength={2048}
          disabled={disabled}
          onChange={(value) => set("audioUrl", value)}
        />
      ) : null}
      {has("durationSeconds") ? (
        <TextField
          name="duration"
          label="Duration (optional)"
          hint="Minutes and seconds, e.g. 46:18, or 1:02:03 for over an hour"
          value={form.duration}
          error={errors.duration}
          maxLength={9}
          disabled={disabled}
          onChange={(value) => set("duration", value)}
        />
      ) : null}
      {has("readMinutes") ? (
        <TextField
          name="readMinutes"
          label="Reading time in minutes (optional)"
          type="number"
          min={1}
          max={600}
          hint="Leave blank to estimate it from the body."
          value={form.readMinutes}
          error={errors.readMinutes}
          disabled={disabled}
          onChange={(value) => set("readMinutes", value)}
        />
      ) : null}
      {has("publicationName") ? (
        <TextField
          name="publicationName"
          label="Publication"
          hint="Where the piece appeared, e.g. Art Plugged"
          value={form.publicationName}
          error={errors.publicationName}
          maxLength={300}
          disabled={disabled}
          onChange={(value) => set("publicationName", value)}
        />
      ) : null}
      {has("externalUrl") ? (
        <TextField
          name="externalUrl"
          label="Link to the piece"
          type="url"
          hint="Must start with https://"
          value={form.externalUrl}
          error={errors.externalUrl}
          maxLength={2048}
          disabled={disabled}
          onChange={(value) => set("externalUrl", value)}
        />
      ) : null}
    </FieldSection>
  );
}

export function StoryFields(props: EntityFieldsProps<StoryForm>) {
  const { form, onChange, disabled, errors } = props;
  const set = <K extends keyof StoryForm>(key: K, value: StoryForm[K]) =>
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
          hint="Decides the format of the story and which details are asked for."
          value={form.kind}
          options={STORY_KINDS.map((kind) => ({ value: kind, label: STORY_KIND_LABELS[kind] }))}
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
        <TextAreaField
          name="standfirst"
          label="Standfirst (optional)"
          className="sm:col-span-2"
          value={form.standfirst}
          error={errors.standfirst}
          maxLength={2000}
          disabled={disabled}
          onChange={(value) => set("standfirst", value)}
        />
        <SelectField
          name="category"
          label="Category"
          hint="The label shown on lax.art story cards."
          value={form.category}
          options={storyCategoryOptions(form.kind)}
          disabled={disabled}
          onChange={(value) => set("category", value)}
        />
        <TextField
          name="authorName"
          label="Author or host (optional)"
          value={form.authorName}
          error={errors.authorName}
          maxLength={300}
          disabled={disabled}
          onChange={(value) => set("authorName", value)}
        />
        <CheckboxField
          name="featured"
          label="Featured on lax.art"
          checked={form.featured}
          disabled={disabled}
          onChange={(value) => set("featured", value)}
        />
      </FieldSection>

      <StoryKindFields {...props} />

      <FieldSection title="Media">
        <TextField
          name="videoUrl"
          label="Video URL (optional)"
          type="url"
          className="sm:col-span-2"
          hint="Must start with https://"
          value={form.videoUrl}
          error={errors.videoUrl}
          maxLength={2048}
          disabled={disabled}
          onChange={(value) => set("videoUrl", value)}
        />
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

      <SeoSection form={form} onChange={onChange} disabled={disabled} errors={errors} />
    </>
  );
}
