"use client";

import { ARTIST_FORM_ID } from "@/components/admin/artist-form/admin-artist-form.constants";
import { ArtistPreview } from "@/components/admin/artist-form/artist-preview";
import { AttributesSection } from "@/components/admin/artist-form/sections/attributes-section";
import { BiographySection } from "@/components/admin/artist-form/sections/biography-section";
import { CategoriesSection } from "@/components/admin/artist-form/sections/categories-section";
import { FlagsSection } from "@/components/admin/artist-form/sections/flags-section";
import { IdentitySection } from "@/components/admin/artist-form/sections/identity-section";
import { KindSection } from "@/components/admin/artist-form/sections/kind-section";
import { LifespanSection } from "@/components/admin/artist-form/sections/lifespan-section";
import { MediaSection } from "@/components/admin/artist-form/sections/media-section";
import { UserLinkSection } from "@/components/admin/artist-form/sections/user-link-section";
import type { ArtistFormValues } from "@/components/admin/artist-form/types";
import { useAdminArtistForm } from "@/components/admin/artist-form/use-admin-artist-form";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import {
  FormActions,
  FormErrorSummary,
  Notice,
  StaffButton,
  UnsavedChangesDialog,
} from "@auction/staff-ui";
import type { CategoryNode } from "@auction/types";
import Link from "next/link";

type Props = {
  mode: "create" | "edit";
  artistId?: string;
  /** The profile's name, for "Discard changes to …?". */
  displayName?: string;
  slug?: string;
  defaultValues: ArtistFormValues;
  categories?: CategoryNode[];
  readOnly?: boolean;
  /** Cancel goes here (defaults to the artists list). */
  cancelHref?: string;
};

/**
 * Creating or editing an artist profile as one page of sections: kind, identity, dates, biography,
 * images, departments, linked account and status. Validates on submit and again as each field
 * changes, lists what to fix at the top, asks before unsaved changes are lost, and keeps a new
 * profile's unfinished form as a draft on this device.
 */
export function AdminArtistForm({
  mode,
  artistId,
  displayName,
  slug,
  defaultValues,
  categories = [],
  readOnly = false,
  cancelHref = "/admin/artists",
}: Props) {
  const {
    form,
    guard,
    submit,
    saving,
    summary,
    submitCount,
    formError,
    draft,
    scenario,
    watchedKind,
    watchedDisplay,
    watchedShortBio,
    watchedPortrait,
  } = useAdminArtistForm({ mode, artistId, displayName, defaultValues, readOnly });
  const { control } = form;
  const base = { control, disabled: readOnly } as const;

  return (
    <>
      <form
        id={ARTIST_FORM_ID}
        noValidate
        aria-label={mode === "create" ? "New artist" : "Edit artist"}
        className="flex flex-col gap-6"
        onSubmit={submit}
      >
        {draft.banner}
        <FormErrorSummary errors={summary} focusKey={submitCount} />
        {formError ? (
          <Notice tone="danger" alert title="The artist was not saved">
            {formError}
          </Notice>
        ) : null}

        <KindSection {...base} kind={watchedKind} />
        <IdentitySection {...base} mode={mode} {...(slug ? { slug } : {})} />
        <LifespanSection {...base} kind={watchedKind} />
        <BiographySection {...base} />
        <MediaSection {...base} />
        <CategoriesSection {...base} categories={categories} />
        <AttributesSection {...base} kind={watchedKind} />
        <UserLinkSection {...base} scenario={scenario} />
        <FlagsSection {...base} />
        <ArtistPreview
          scenario={scenario}
          data={{
            displayName: String(watchedDisplay),
            kindLabel: artistKindMeta(watchedKind).label,
            shortBio: String(watchedShortBio ?? ""),
            portraitUrl: String(watchedPortrait ?? ""),
          }}
        />

        <FormActions sticky start={draft.status}>
          <StaffButton asChild variant="secondary">
            <Link href={cancelHref}>{readOnly ? "Back to profile" : "Cancel"}</Link>
          </StaffButton>
          {readOnly ? null : (
            <StaffButton type="submit" variant="primary" loading={saving}>
              {mode === "create" ? "Create artist" : "Save changes"}
            </StaffButton>
          )}
        </FormActions>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </>
  );
}
