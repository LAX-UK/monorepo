"use client";

import { ARTIST_STATUS_OPTIONS } from "@/components/admin/artist-form/admin-artist-form.constants";
import { ArtistPreview } from "@/components/admin/artist-form/artist-preview";
import { KindSelector } from "@/components/admin/artist-form/kind-selector";
import { AttributesSection } from "@/components/admin/artist-form/sections/attributes-section";
import { BiographySection } from "@/components/admin/artist-form/sections/biography-section";
import { CategoriesSection } from "@/components/admin/artist-form/sections/categories-section";
import { FlagsSection } from "@/components/admin/artist-form/sections/flags-section";
import { IdentitySection } from "@/components/admin/artist-form/sections/identity-section";
import { LifespanSection } from "@/components/admin/artist-form/sections/lifespan-section";
import { MediaSection } from "@/components/admin/artist-form/sections/media-section";
import { UserLinkSection } from "@/components/admin/artist-form/sections/user-link-section";
import type { ArtistFormValues, ArtistScenario } from "@/components/admin/artist-form/types";
import { CatalogFormSection as ArtistFormSection } from "@/components/admin/forms/catalog-form-section";
import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import {
  type ArtistKind,
  type ArtistStatus,
  type CategoryNode,
  getCreatorKindConfig,
} from "@auction/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type { Control } from "react-hook-form";

type AdminArtistWizardStepsProps = {
  stepIndex: number;
  control: Control<ArtistFormValues>;
  mode: "create" | "edit";
  slug?: string;
  categories: CategoryNode[];
  activeScenario: ArtistScenario;
  watchedKind: ArtistKind;
  watchedDisplay: string;
  watchedShortBio: string;
  watchedPortrait: string;
  isSubmitting: boolean;
  readOnly: boolean;
};

export function AdminArtistWizardSteps({
  stepIndex,
  control,
  mode,
  slug,
  categories,
  activeScenario,
  watchedKind,
  watchedDisplay,
  watchedShortBio,
  watchedPortrait,
  isSubmitting,
  readOnly,
}: AdminArtistWizardStepsProps) {
  const kindConfig = getCreatorKindConfig(watchedKind);
  const disabled = isSubmitting || readOnly;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="min-w-0 space-y-6">
        {stepIndex === 0 ? (
          <div className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                What kind of creator is this?
              </h2>
              <p className="text-sm text-on-surface-variant">
                The form adapts its labels, lifespan fields, and attributes to the selected kind.
              </p>
            </div>
            <FormField
              control={control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <KindSelector
                      value={(field.value as ArtistKind | undefined) ?? "artist"}
                      onChange={(k) => field.onChange(k)}
                      onBlur={field.onBlur}
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}

        {stepIndex === 1 ? (
          <>
            {activeScenario === "maker-seller" ? (
              <ArtistFormSection
                title="Platform user"
                description="Who this catalogue profile represents when they sell their own work."
                defaultOpen
              >
                <UserLinkSection control={control} disabled={disabled} emphasize />
              </ArtistFormSection>
            ) : null}
            <ArtistFormSection
              title="Identity"
              description={
                mode === "edit"
                  ? "Public name and place. URL slug is set at creation."
                  : "Public name and place — a unique slug is generated when you save."
              }
              defaultOpen
            >
              <IdentitySection
                control={control}
                mode={mode}
                {...(mode === "edit" && slug ? { slug } : {})}
                disabled={disabled}
              />
            </ArtistFormSection>
            <ArtistFormSection
              title="Lifespan & origin"
              description={
                kindConfig.lifespanMode === "organisation"
                  ? "Founded / dissolved years and country of origin."
                  : "Birth / death years and country."
              }
              defaultOpen
            >
              <LifespanSection control={control} kind={watchedKind} disabled={disabled} />
            </ArtistFormSection>
          </>
        ) : null}

        {stepIndex === 2 ? (
          <>
            <ArtistFormSection
              title="Biography"
              description="Copy shown on the public artist profile."
              defaultOpen
            >
              <BiographySection control={control} disabled={disabled} />
            </ArtistFormSection>
            <ArtistFormSection
              title="Media"
              description="Portrait, hero, and website links."
              defaultOpen
            >
              <MediaSection control={control} disabled={disabled} />
            </ArtistFormSection>
          </>
        ) : null}

        {stepIndex === 3 ? (
          <>
            <ArtistFormSection
              title="Departments"
              description="Collecting categories this creator belongs to."
              defaultOpen
            >
              <CategoriesSection control={control} categories={categories} disabled={disabled} />
            </ArtistFormSection>
            <ArtistFormSection
              title={`${kindConfig.label} attributes`}
              description="Kind-specific details surfaced on the public profile."
              defaultOpen
            >
              <AttributesSection control={control} kind={watchedKind} disabled={disabled} />
            </ArtistFormSection>
          </>
        ) : null}

        {stepIndex === 4 ? (
          <>
            <ArtistPreview
              scenario={activeScenario}
              data={{
                displayName: String(watchedDisplay),
                kindLabel: artistKindMeta(watchedKind).label,
                shortBio: String(watchedShortBio ?? ""),
                portraitUrl: String(watchedPortrait ?? ""),
              }}
            />
            <ArtistFormSection
              title="Catalogue status"
              description="Controls public visibility of the profile."
              defaultOpen
            >
              <FormField
                control={control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <LabelCaps>Status</LabelCaps>
                    </FormLabel>
                    <RhfSelect
                      value={field.value ?? "approved"}
                      onValueChange={(v) => field.onChange(v as ArtistStatus)}
                      onBlur={field.onBlur}
                      disabled={disabled}
                      options={[...ARTIST_STATUS_OPTIONS]}
                      triggerClassName="min-h-11 w-full font-body text-sm"
                    />
                    <p className="text-xs text-on-surface-variant">
                      Approved profiles appear in the public directory. Pending hides the profile
                      and flags attached lots for review.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </ArtistFormSection>
            <ArtistFormSection
              title="Visibility"
              description="Featured, verified, and archive flags."
              defaultOpen
            >
              <FlagsSection control={control} disabled={disabled} />
            </ArtistFormSection>
            {activeScenario === "historical" ? (
              <ArtistFormSection
                title="Optional user link"
                description="Rarely needed for external profiles; use the maker–seller path when the seller is the maker."
                defaultOpen={false}
              >
                <UserLinkSection control={control} disabled={disabled} emphasize={false} />
              </ArtistFormSection>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
