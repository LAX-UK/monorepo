"use client";

import { type ArtistChipModel, ArtistPicker } from "@/components/admin/artist-picker";
import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { LotImageManager } from "@/components/admin/lot-image-manager";
import { CategoryPicker } from "@/components/forms/category-picker";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import type { ArtistProfile, CategoryNode } from "@auction/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  categories: CategoryNode[];
  artists: ArtistProfile[];
};

export function LotCatalogueStep({ form, categories, artists }: Props) {
  return (
    <>
      <CatalogFormSection
        title="Catalogue & schedule"
        description="Artist, pricing, categories, bidding rules, schedule, and physical details."
        collapsible={false}
      >
        <FormField
          control={form.control}
          name="artistId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>Artist / Maker / Brand</LabelCaps>
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

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startingPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Starting price</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reservePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Reserve (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="buyNowPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Buy now (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="buyerPremiumRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Buyer premium (0–1)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="0.25" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="minBidIncrement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Min bid increment</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="1.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="categoryIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Categories</LabelCaps>
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
                <p className="mt-2 font-body text-xs text-on-surface-variant">
                  Choose one or more categories. The first selected is the primary.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Start (local)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    className="min-h-11 py-3 font-body text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>End (local)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    className="min-h-11 py-3 font-body text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="medium"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Medium (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dimensions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Dimensions (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CatalogFormSection>

      <CatalogFormSection
        title="Dutch options (optional)"
        description="Only used when the lot type is Dutch."
        collapsible={false}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="dutchDecrementAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Dutch decrement (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dutchDecrementIntervalMs"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Dutch interval ms (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="60000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CatalogFormSection>

      <CatalogFormSection
        title="Images"
        description="Catalogue photos and alt text."
        collapsible={false}
      >
        <FormField
          control={form.control}
          name="images"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Lot images</LabelCaps>
              </FormLabel>
              <FormControl>
                <LotImageManager
                  value={field.value.map((key, index) => ({
                    key,
                    alt: form.getValues("imageAlts")[index] ?? "",
                  }))}
                  onChange={(next) => {
                    field.onChange(next.map((item) => item.key));
                    form.setValue(
                      "imageAlts",
                      next.map((item) => item.alt),
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CatalogFormSection>
    </>
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
