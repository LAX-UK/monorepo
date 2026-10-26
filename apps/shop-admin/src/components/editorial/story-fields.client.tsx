"use client";

import {
  EditorialCheckbox,
  EditorialSelectField,
  EditorialTextArea,
  EditorialTextField,
  type EntityFieldsProps,
  FieldSection,
  SeoSection,
  SlugField,
} from "@/components/editorial/editorial-field-parts.client";
import { EditorialImageField } from "@/components/editorial/editorial-image-field.client";
import type { StoryForm } from "@/lib/editorial-entity-forms";
import {
  STORY_KINDS,
  STORY_KIND_LABELS,
  type StoryKindField,
  storyCategoryOptions,
  storyKindHasField,
} from "@/lib/editorial-story-kinds";
import { FieldRow } from "@auction/staff-ui";

/** The category menu has no empty option, so "use the kind's default" is a value of its own. */
const DEFAULT_CATEGORY = "default";

/** The fields only some kinds use. A field shows when the chosen kind uses it. */
function StoryKindFields({ form, onChange, disabled, errors }: EntityFieldsProps<StoryForm>) {
  const set = <K extends keyof StoryForm>(key: K, value: StoryForm[K]) =>
    onChange({ ...form, [key]: value });
  const has = (field: StoryKindField) => storyKindHasField(form.kind, field);
  const label = STORY_KIND_LABELS[form.kind];

  return (
    <FieldSection title={`${label} details`} description="Asked for because of the story's kind.">
      {has("series") || has("episodeNumber") ? (
        <FieldRow>
          {has("series") ? (
            <EditorialTextField
              name="series"
              label="Series"
              optional
              value={form.series}
              error={errors.series}
              maxLength={120}
              disabled={disabled}
              onChange={(value) => set("series", value)}
            />
          ) : null}
          {has("episodeNumber") ? (
            <EditorialTextField
              name="episodeNumber"
              label="Episode number"
              optional
              type="number"
              min={1}
              value={form.episodeNumber}
              error={errors.episodeNumber}
              disabled={disabled}
              onChange={(value) => set("episodeNumber", value)}
            />
          ) : null}
        </FieldRow>
      ) : null}
      {has("audioUrl") ? (
        <EditorialTextField
          name="audioUrl"
          label="Audio URL"
          type="url"
          description="Link to the episode audio; it must start with https://"
          value={form.audioUrl}
          error={errors.audioUrl}
          maxLength={2048}
          disabled={disabled}
          onChange={(value) => set("audioUrl", value)}
        />
      ) : null}
      {has("durationSeconds") ? (
        <EditorialTextField
          name="duration"
          label="Duration"
          optional
          description="Minutes and seconds, such as 46:18, or 1:02:03 for over an hour."
          value={form.duration}
          error={errors.duration}
          maxLength={9}
          disabled={disabled}
          onChange={(value) => set("duration", value)}
        />
      ) : null}
      {has("readMinutes") ? (
        <EditorialTextField
          name="readMinutes"
          label="Reading time in minutes"
          optional
          type="number"
          min={1}
          max={600}
          description="Leave blank to estimate it from the body."
          value={form.readMinutes}
          error={errors.readMinutes}
          disabled={disabled}
          onChange={(value) => set("readMinutes", value)}
        />
      ) : null}
      {has("publicationName") ? (
        <EditorialTextField
          name="publicationName"
          label="Publication"
          description="Where the piece appeared, such as Art Plugged."
          value={form.publicationName}
          error={errors.publicationName}
          maxLength={300}
          disabled={disabled}
          onChange={(value) => set("publicationName", value)}
        />
      ) : null}
      {has("externalUrl") ? (
        <EditorialTextField
          name="externalUrl"
          label="Link to the piece"
          type="url"
          description="It must start with https://"
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
          description="Decides the format of the story and which details are asked for."
          value={form.kind}
          error={errors.kind}
          disabled={disabled}
          options={STORY_KINDS.map((kind) => ({ value: kind, label: STORY_KIND_LABELS[kind] }))}
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
        <EditorialTextArea
          name="standfirst"
          label="Standfirst"
          optional
          value={form.standfirst}
          error={errors.standfirst}
          maxLength={2000}
          disabled={disabled}
          onChange={(value) => set("standfirst", value)}
        />
        <FieldRow>
          <EditorialSelectField
            name="category"
            label="Category"
            description="The label on story cards."
            value={form.category || DEFAULT_CATEGORY}
            error={errors.category}
            disabled={disabled}
            options={storyCategoryOptions(form.kind).map((option) => ({
              value: option.value || DEFAULT_CATEGORY,
              label: option.label,
            }))}
            onValueChange={(value) =>
              set("category", value === DEFAULT_CATEGORY ? "" : (value as StoryForm["category"]))
            }
          />
          <EditorialTextField
            name="authorName"
            label="Author or host"
            optional
            value={form.authorName}
            error={errors.authorName}
            maxLength={300}
            disabled={disabled}
            onChange={(value) => set("authorName", value)}
          />
        </FieldRow>
        <EditorialCheckbox
          name="featured"
          label="Featured on lax.art"
          checked={form.featured}
          disabled={disabled}
          onChange={(value) => set("featured", value)}
        />
      </FieldSection>

      <StoryKindFields {...props} />

      <FieldSection title="Media" description="The cover image and an optional video.">
        <EditorialImageField
          name="coverMediaKey"
          label="Cover image"
          kind="editorial_cover"
          value={form.coverMediaKey}
          disabled={disabled}
          onChange={(key) => set("coverMediaKey", key)}
        />
        <EditorialTextField
          name="videoUrl"
          label="Video URL"
          optional
          type="url"
          description="It must start with https://"
          value={form.videoUrl}
          error={errors.videoUrl}
          maxLength={2048}
          disabled={disabled}
          onChange={(value) => set("videoUrl", value)}
        />
      </FieldSection>

      <SeoSection form={form} onChange={onChange} disabled={disabled} errors={errors} />
    </>
  );
}
