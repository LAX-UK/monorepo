"use client";

import { type ArtistChipModel, ArtistPicker } from "@/components/admin/artist-picker";
import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { CategoryPicker } from "@/components/forms/category-picker";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import type { ArtistProfile, CategoryNode } from "@auction/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type { UseFormReturn } from "react-hook-form";
import { CatalogueFieldHelp } from "./catalogue-field-help";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  categories: CategoryNode[];
  artists: ArtistProfile[];
  showArtistField?: boolean;
  fields: Pick<
    Record<LotCatalogueFieldKey, FieldSpec>,
    "artistId" | "categoryIds" | "medium" | "dimensions"
  >;
};

export function CatalogueDetailsSection({
  form,
  categories,
  artists,
  showArtistField = true,
  fields,
}: Props) {
  const showArtist = showArtistField && fields.artistId.visible;
  const showCategories = fields.categoryIds.visible;
  const showMedium = fields.medium.visible;
  const showDimensions = fields.dimensions.visible;

  if (!showArtist && !showCategories && !showMedium && !showDimensions) return null;

  return (
    <CatalogFormSection
      title="Catalogue details"
      description="Categories, attribution, and physical details."
      collapsible={false}
    >
      {showArtist ? (
        <FormField
          control={form.control}
          name="artistId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>{fields.artistId.label}</LabelCaps>
              </FormLabel>
              <FormControl>
                <ArtistPicker
                  value={field.value ?? null}
                  onChange={(id: string | null) => field.onChange(id)}
                  selected={chipFromArtists(artists, field.value ?? null)}
                  helpText="Catalogue identity for this lot. Required before publish — sellers do not pick this themselves."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      {showCategories ? (
        <FormField
          control={form.control}
          name="categoryIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>{fields.categoryIds.label}</LabelCaps>
              </FormLabel>
              <FormControl>
                <CategoryPicker
                  categories={categories}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select categories"
                  multiple={true}
                />
              </FormControl>
              <CatalogueFieldHelp text={fields.categoryIds.helpText} />
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      {showMedium || showDimensions ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {showMedium ? (
            <FormField
              control={form.control}
              name="medium"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>{fields.medium.label}</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
          {showDimensions ? (
            <FormField
              control={form.control}
              name="dimensions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>{fields.dimensions.label}</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
        </div>
      ) : null}
    </CatalogFormSection>
  );
}

function chipFromArtists(
  artists: ArtistProfile[],
  artistId: string | null,
): ArtistChipModel | null {
  if (!artistId) return null;
  const found = artists.find((a) => a.id === artistId);
  if (!found) return null;
  return {
    id: found.id,
    displayName: found.displayName,
    slug: found.slug,
    kind: found.kind ?? "artist",
    status: found.status ?? "approved",
  };
}
