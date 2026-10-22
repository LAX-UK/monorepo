"use client";

import { MediaUploadField } from "@/components/media-upload-field";
import { SeoFieldsInputs } from "@/components/seo-fields-inputs.client";
import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  requiredText,
} from "@/lib/form-validation";
import { ARTWORK_MEDIUM_MAX_LENGTH, buildImportArtworkInput } from "@/lib/import-artwork-form";
import {
  SEO_FIELD_ERRORS,
  type SeoFieldsFormValues,
  seoFieldsFormValues,
} from "@/lib/seo-fields-form";
import { importArtwork } from "@/server/application/admin-catalogue-actions.server";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { CheckboxField, TextField } from "../fields";

export function ImportArtworkForm() {
  const mutation = useAdminMutation();
  const [importKey, setImportKey] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [medium, setMedium] = useState("");
  const [artistSlug, setArtistSlug] = useState("");
  const [artistDisplayName, setArtistDisplayName] = useState("");
  const [eligible, setEligible] = useState(true);
  const [primaryImageKey, setPrimaryImageKey] = useState<string | null>(null);
  const [primaryImagePublicUrl, setPrimaryImagePublicUrl] = useState<string | null>(null);
  const [seo, setSeo] = useState<SeoFieldsFormValues>(seoFieldsFormValues(null));
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Import artwork"
      mutation={mutation}
      errors={errors}
      submitLabel="Import"
      onSubmit={() => {
        const missing = collectFieldErrors({
          importKey: requiredText(importKey, "Enter the import key."),
          slug: requiredText(slug, "Enter the slug."),
          title: requiredText(title, "Enter the title."),
          artistSlug: requiredText(artistSlug, "Enter the artist slug."),
          artistDisplayName: requiredText(artistDisplayName, "Enter the artist display name."),
        });
        const built = buildImportArtworkInput({
          importKey,
          slug,
          title,
          medium,
          primaryImageUrl: primaryImagePublicUrl,
          artistSlug,
          artistDisplayName,
          eligibleForEditionAllocation: eligible,
          ...seo,
        });
        const next: FieldErrors = { ...missing };
        if (!built.ok && built.error === "medium_too_long") {
          next.medium = `Medium must be ${ARTWORK_MEDIUM_MAX_LENGTH} characters or fewer.`;
        } else if (!built.ok && built.error === "seo_title_too_long") {
          next.seoTitle = SEO_FIELD_ERRORS.seoTitle;
        } else if (!built.ok && built.error === "seo_description_too_long") {
          next.seoDescription = SEO_FIELD_ERRORS.seoDescription;
        }
        setErrors(next);
        if (hasFieldErrors(next) || !built.ok) return;
        void mutation.run(
          () => importArtwork({ ...built.input, idempotencyKey: mutation.idempotencyKey }),
          "Artwork imported",
        );
      }}
    >
      <TextField
        name="importKey"
        label="Import key"
        value={importKey}
        error={errors.importKey}
        disabled={mutation.pending}
        onChange={setImportKey}
      />
      <TextField
        name="slug"
        label="Slug"
        value={slug}
        error={errors.slug}
        disabled={mutation.pending}
        onChange={setSlug}
      />
      <TextField
        name="title"
        label="Title"
        value={title}
        error={errors.title}
        disabled={mutation.pending}
        onChange={setTitle}
      />
      <MediaUploadField
        kind="artwork_image"
        label="Primary image"
        value={primaryImageKey}
        publicUrl={primaryImagePublicUrl}
        disabled={mutation.pending}
        onChange={(key, url) => {
          setPrimaryImageKey(key);
          setPrimaryImagePublicUrl(url);
        }}
      />
      <TextField
        name="medium"
        label="Medium (optional)"
        hint="Blank clears it."
        value={medium}
        error={errors.medium}
        maxLength={ARTWORK_MEDIUM_MAX_LENGTH}
        placeholder="e.g. Oil on linen"
        disabled={mutation.pending}
        onChange={setMedium}
      />
      <TextField
        name="artistSlug"
        label="Artist slug"
        value={artistSlug}
        error={errors.artistSlug}
        disabled={mutation.pending}
        onChange={setArtistSlug}
      />
      <TextField
        name="artistDisplayName"
        label="Artist display name"
        value={artistDisplayName}
        error={errors.artistDisplayName}
        disabled={mutation.pending}
        onChange={setArtistDisplayName}
      />
      <CheckboxField
        name="eligible"
        label="Eligible for edition allocation"
        checked={eligible}
        disabled={mutation.pending}
        onChange={setEligible}
      />
      <SeoFieldsInputs
        values={seo}
        disabled={mutation.pending}
        blankHint="blank leaves unchanged"
        errors={errors}
        onChange={setSeo}
      />
    </AdminForm>
  );
}
