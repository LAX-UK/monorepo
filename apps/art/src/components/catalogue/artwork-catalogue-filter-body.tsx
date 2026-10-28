"use client";

import type { ArtworkCatalogueDraft } from "@/lib/catalogue/artwork-catalogue-draft";
import {
  ARTWORK_FILTER_DEFAULT_OPEN,
  ARTWORK_SALE_STATE_OPTIONS,
  ARTWORK_SORT_OPTIONS,
  type ArtworkFilterOption,
} from "@/lib/catalogue/artwork-catalogue-filter-config";
import { MarketingFilterAccordionSection, MarketingFilterFacetGroup } from "@auction/marketing-ui";
import { Accordion } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { useState } from "react";

export type CatalogueFilterOption = {
  slug: string;
  label: string;
};

type Props = {
  draft: ArtworkCatalogueDraft;
  onDraftChange: (next: ArtworkCatalogueDraft) => void;
  categories: readonly CatalogueFilterOption[];
  artists: readonly CatalogueFilterOption[];
  mediumOptions: readonly ArtworkFilterOption[];
};

const ID_PREFIX = "art-filters";

function slugOptions(items: readonly CatalogueFilterOption[]): ArtworkFilterOption[] {
  return items.map((item) => ({ value: item.slug, label: item.label }));
}

function PriceInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <Label htmlFor={id} className="font-body text-sm font-normal">
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        className="min-h-11"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ""))}
      />
    </div>
  );
}

/**
 * Drawer facets (Figma 541:6507). Every choice edits the draft; the drawer's Apply commits it.
 * Multi-select where shop-api accepts several values (artist, medium), radio otherwise. lax.art
 * lists originals only, so Figma's Department and Rarity sections have nothing to choose between.
 */
export function ArtworkCatalogueFilterBody({
  draft,
  onDraftChange,
  categories,
  artists,
  mediumOptions,
}: Props) {
  const [openSections, setOpenSections] = useState<string[]>(ARTWORK_FILTER_DEFAULT_OPEN);
  const categoryOptions = [{ value: "", label: "Any category" }, ...slugOptions(categories)];

  return (
    <Accordion type="multiple" value={openSections} onValueChange={setOpenSections}>
      <MarketingFilterFacetGroup
        value="sort"
        title="Sort by"
        idPrefix={`${ID_PREFIX}-sort`}
        selection="single"
        options={ARTWORK_SORT_OPTIONS}
        selected={[draft.sort]}
        onChange={([sort]) =>
          onDraftChange({ ...draft, sort: sort as ArtworkCatalogueDraft["sort"] })
        }
      />
      {artists.length > 0 ? (
        <MarketingFilterFacetGroup
          value="artist"
          title="Artist"
          idPrefix={`${ID_PREFIX}-artist`}
          options={slugOptions(artists)}
          selected={draft.artistSlugs}
          onChange={(artistSlugs) => onDraftChange({ ...draft, artistSlugs })}
        />
      ) : null}
      <MarketingFilterFacetGroup
        value="objectType"
        title="Medium"
        idPrefix={`${ID_PREFIX}-medium`}
        options={mediumOptions}
        selected={draft.objectTypes}
        onChange={(objectTypes) =>
          onDraftChange({
            ...draft,
            objectTypes: objectTypes as ArtworkCatalogueDraft["objectTypes"],
          })
        }
      />
      {categories.length > 0 ? (
        <MarketingFilterFacetGroup
          value="category"
          title="Category"
          idPrefix={`${ID_PREFIX}-category`}
          selection="single"
          options={categoryOptions}
          selected={[draft.categorySlug]}
          onChange={([categorySlug = ""]) => onDraftChange({ ...draft, categorySlug })}
        />
      ) : null}
      <MarketingFilterFacetGroup
        value="availability"
        title="Availability"
        idPrefix={`${ID_PREFIX}-availability`}
        selection="single"
        options={ARTWORK_SALE_STATE_OPTIONS}
        selected={[draft.saleState]}
        onChange={([saleState = ""]) =>
          onDraftChange({
            ...draft,
            saleState: saleState as ArtworkCatalogueDraft["saleState"],
          })
        }
      />
      <MarketingFilterAccordionSection value="price" title="Price">
        <p className="mb-3 font-body text-xs text-on-surface-variant">
          Price-on-request works are left out of a price range.
        </p>
        <div className="flex gap-3">
          <PriceInput
            id={`${ID_PREFIX}-min-price`}
            label="Min (£)"
            value={draft.minPrice}
            onChange={(minPrice) => onDraftChange({ ...draft, minPrice })}
          />
          <PriceInput
            id={`${ID_PREFIX}-max-price`}
            label="Max (£)"
            value={draft.maxPrice}
            onChange={(maxPrice) => onDraftChange({ ...draft, maxPrice })}
          />
        </div>
      </MarketingFilterAccordionSection>
    </Accordion>
  );
}
