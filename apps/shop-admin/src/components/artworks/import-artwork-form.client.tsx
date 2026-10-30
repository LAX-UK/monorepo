"use client";

import {
  EditorialCheckbox,
  EditorialTextField,
  FieldSection,
  SeoSection,
  editorialFieldId,
} from "@/components/editorial/editorial-field-parts.client";
import { EditorialImageField } from "@/components/editorial/editorial-image-field.client";
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
import { FormActions, FormErrorSummary, Notice, StaffButton } from "@auction/staff-ui";
import { Upload } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useState } from "react";

/** The order problems are listed in: the page's own order, top to bottom. */
const FIELD_ORDER = [
  "importKey",
  "slug",
  "title",
  "medium",
  "artistSlug",
  "artistDisplayName",
  "seoTitle",
  "seoDescription",
] as const;

/**
 * Creates or refreshes an artwork from one external catalogue row, keyed by its import key.
 * Problems are listed at the top and beside their fields; a refused import stays on the form.
 */
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
  const [failedSubmits, setFailedSubmits] = useState(0);
  const disabled = mutation.pending;

  function submit() {
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
    if (hasFieldErrors(next) || !built.ok) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    void mutation.run(
      () => importArtwork({ ...built.input, idempotencyKey: mutation.idempotencyKey }),
      "Artwork imported",
    );
  }

  const summary = FIELD_ORDER.filter((name) => errors[name]).map((name) => ({
    fieldId: editorialFieldId(name),
    message: errors[name] as string,
  }));

  return (
    <form
      noValidate
      aria-label="Import artwork"
      className="flex flex-col gap-6 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <FormErrorSummary errors={summary} focusKey={failedSubmits} />

      <FieldSection
        title="Catalogue row"
        description="How the row is identified. Importing a key that already exists updates that artwork."
      >
        <EditorialTextField
          name="importKey"
          label="Import key"
          value={importKey}
          error={errors.importKey}
          disabled={disabled}
          onChange={setImportKey}
        />
        <EditorialTextField
          name="slug"
          label="Slug"
          description="The artwork's address on lax.art."
          value={slug}
          error={errors.slug}
          spellCheck={false}
          disabled={disabled}
          onChange={setSlug}
        />
        <EditorialTextField
          name="title"
          label="Title"
          value={title}
          error={errors.title}
          disabled={disabled}
          onChange={setTitle}
        />
        <EditorialTextField
          name="medium"
          label="Medium"
          optional
          description="Leave blank to clear it."
          placeholder="Oil on linen"
          value={medium}
          error={errors.medium}
          maxLength={ARTWORK_MEDIUM_MAX_LENGTH}
          disabled={disabled}
          onChange={setMedium}
        />
        <EditorialCheckbox
          name="eligible"
          label="Eligible for edition allocation"
          checked={eligible}
          disabled={disabled}
          onChange={setEligible}
        />
      </FieldSection>

      <FieldSection title="Artist" description="Who the artwork is shown under.">
        <EditorialTextField
          name="artistSlug"
          label="Artist slug"
          value={artistSlug}
          error={errors.artistSlug}
          spellCheck={false}
          disabled={disabled}
          onChange={setArtistSlug}
        />
        <EditorialTextField
          name="artistDisplayName"
          label="Artist display name"
          value={artistDisplayName}
          error={errors.artistDisplayName}
          disabled={disabled}
          onChange={setArtistDisplayName}
        />
      </FieldSection>

      <FieldSection title="Image" description="The primary image shown on lax.art.">
        <EditorialImageField
          name="primaryImage"
          label="Primary image"
          kind="artwork_image"
          value={primaryImageKey}
          disabled={disabled}
          onChange={(key, url) => {
            setPrimaryImageKey(key);
            setPrimaryImagePublicUrl(key ? (url ?? null) : null);
          }}
        />
      </FieldSection>

      <SeoSection
        form={seo}
        errors={errors}
        disabled={disabled}
        onChange={setSeo}
        description="How the artwork appears in search results. Leave blank to keep what an earlier import set."
      />

      {mutation.message ? (
        <Notice
          tone="danger"
          alert
          title={mutation.message}
          {...(mutation.stepUpRequired
            ? {
                actions: (
                  <StaffButton asChild size="sm" variant="secondary">
                    <Link href={mutation.stepUpHref}>Sign in again</Link>
                  </StaffButton>
                ),
              }
            : {})}
        />
      ) : null}

      <FormActions>
        <StaffButton
          type="submit"
          variant="primary"
          icon={<Upload aria-hidden />}
          loading={mutation.pending}
        >
          {mutation.pending ? "Importing…" : "Import artwork"}
        </StaffButton>
      </FormActions>
    </form>
  );
}
