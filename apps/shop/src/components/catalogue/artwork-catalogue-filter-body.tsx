"use client";

import {
  ARTWORK_FILTER_DEFAULT_OPEN,
  ARTWORK_FILTER_GROUPS,
  ARTWORK_SALE_STATE_OPTIONS,
  ARTWORK_TYPE_OPTIONS,
  type ArtworkFilterGroupValue,
} from "@/lib/catalogue/artwork-catalogue-filter-config";
import type { ArtworkCatalogueUrlState } from "@/lib/catalogue/artwork-catalogue-params";
import {
  MARKETING_FILTER_ACCORDION_TRIGGER,
  MARKETING_FILTER_RESULT_COUNT,
  MarketingFilterSidebar,
  marketingFilterRailLink,
} from "@auction/marketing-ui";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, cn } from "@auction/ui";
import { type ReactNode, useState } from "react";

export type CatalogueFilterOption = {
  slug: string;
  label: string;
};

export type ArtworkCatalogueDraft = {
  q: string;
  type: ArtworkCatalogueUrlState["type"];
  saleState: ArtworkCatalogueUrlState["saleState"] | "";
  categorySlug: string;
  artistSlug: string;
  minPrice: string;
  maxPrice: string;
};

export function artworkDraftFromState(state: ArtworkCatalogueUrlState): ArtworkCatalogueDraft {
  return {
    q: state.q ?? "",
    type: state.type,
    saleState: state.saleState ?? "",
    categorySlug: state.categorySlug ?? "",
    artistSlug: state.artistSlug ?? "",
    minPrice: state.minPrice !== undefined ? String(state.minPrice) : "",
    maxPrice: state.maxPrice !== undefined ? String(state.maxPrice) : "",
  };
}

export function draftToPartialState(
  draft: ArtworkCatalogueDraft,
): Partial<ArtworkCatalogueUrlState> {
  const minParsed = draft.minPrice.trim() ? Number.parseInt(draft.minPrice, 10) : undefined;
  const maxParsed = draft.maxPrice.trim() ? Number.parseInt(draft.maxPrice, 10) : undefined;
  return {
    ...(draft.q.trim() ? { q: draft.q.trim() } : {}),
    type: draft.type,
    ...(draft.saleState ? { saleState: draft.saleState } : {}),
    ...(draft.categorySlug ? { categorySlug: draft.categorySlug } : {}),
    ...(draft.artistSlug ? { artistSlug: draft.artistSlug } : {}),
    ...(minParsed !== undefined && !Number.isNaN(minParsed) ? { minPrice: minParsed } : {}),
    ...(maxParsed !== undefined && !Number.isNaN(maxParsed) ? { maxPrice: maxParsed } : {}),
  };
}

type Props = {
  draft: ArtworkCatalogueDraft;
  onDraftChange: (next: ArtworkCatalogueDraft) => void;
  categories: CatalogueFilterOption[];
  artists: CatalogueFilterOption[];
  resultCount?: number | undefined;
  showResultCount?: boolean;
  className?: string;
};

const itemBorderClass = "border-b border-outline-variant dark:border-outline-variant/30";

function RailOption({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button type="button" className={marketingFilterRailLink(active)} onClick={onSelect}>
      {label}
    </button>
  );
}

function groupContent(group: ArtworkFilterGroupValue, props: Props): ReactNode {
  const { draft, onDraftChange, categories, artists } = props;
  switch (group) {
    case "type":
      return (
        <div className="flex flex-col gap-1">
          {ARTWORK_TYPE_OPTIONS.map((option) => (
            <RailOption
              key={option.value}
              active={draft.type === option.value}
              label={option.label}
              onSelect={() => onDraftChange({ ...draft, type: option.value })}
            />
          ))}
        </div>
      );
    case "availability":
      return (
        <div className="flex flex-col gap-1">
          {ARTWORK_SALE_STATE_OPTIONS.map((option) => (
            <RailOption
              key={option.value || "any"}
              active={draft.saleState === option.value}
              label={option.label}
              onSelect={() =>
                onDraftChange({
                  ...draft,
                  saleState: option.value as ArtworkCatalogueDraft["saleState"],
                })
              }
            />
          ))}
        </div>
      );
    case "category":
      return (
        <div className="flex flex-col gap-1">
          <RailOption
            active={!draft.categorySlug}
            label="Any category"
            onSelect={() => onDraftChange({ ...draft, categorySlug: "" })}
          />
          {categories.map((category) => (
            <RailOption
              key={category.slug}
              active={draft.categorySlug === category.slug}
              label={category.label}
              onSelect={() => onDraftChange({ ...draft, categorySlug: category.slug })}
            />
          ))}
        </div>
      );
    case "artist":
      return (
        <div className="flex flex-col gap-1">
          <RailOption
            active={!draft.artistSlug}
            label="Any artist"
            onSelect={() => onDraftChange({ ...draft, artistSlug: "" })}
          />
          {artists.map((artist) => (
            <RailOption
              key={artist.slug}
              active={draft.artistSlug === artist.slug}
              label={artist.label}
              onSelect={() => onDraftChange({ ...draft, artistSlug: artist.slug })}
            />
          ))}
        </div>
      );
    case "price":
      return (
        <div className="flex flex-col gap-3">
          <p className="font-body text-xs text-on-surface-variant">
            Applies to prints with a listed price. Originals and price-on-request works are excluded
            from numeric ranges.
          </p>
          <label className="flex flex-col gap-1 font-body text-sm">
            <span>Min (£)</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className="min-h-11 rounded-md border border-outline-variant/50 bg-surface px-3"
              value={draft.minPrice}
              onChange={(event) => onDraftChange({ ...draft, minPrice: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 font-body text-sm">
            <span>Max (£)</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className="min-h-11 rounded-md border border-outline-variant/50 bg-surface px-3"
              value={draft.maxPrice}
              onChange={(event) => onDraftChange({ ...draft, maxPrice: event.target.value })}
            />
          </label>
        </div>
      );
  }
}

/** Shared faceted filter body for desktop rail and mobile sheet. */
export function ArtworkCatalogueFilterBody({
  draft,
  onDraftChange,
  categories,
  artists,
  resultCount,
  showResultCount = true,
  className,
}: Props) {
  const [openSections, setOpenSections] = useState<string[]>(ARTWORK_FILTER_DEFAULT_OPEN);

  return (
    <MarketingFilterSidebar
      className={cn(
        "space-y-4 pb-0 lg:border-outline-variant dark:lg:border-outline-variant/30",
        className,
      )}
    >
      {showResultCount && resultCount !== undefined ? (
        <div className="border-b border-outline-variant pb-3 dark:border-outline-variant/30">
          <p className={MARKETING_FILTER_RESULT_COUNT} aria-live="polite" aria-atomic="true">
            Showing {resultCount} result{resultCount === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      <Accordion
        type="multiple"
        className="w-full"
        value={openSections}
        onValueChange={setOpenSections}
      >
        {ARTWORK_FILTER_GROUPS.map((group) => (
          <AccordionItem key={group.value} value={group.value} className={itemBorderClass}>
            <AccordionTrigger className={MARKETING_FILTER_ACCORDION_TRIGGER}>
              {group.title}
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1">
              {groupContent(group.value, {
                draft,
                onDraftChange,
                categories,
                artists,
                ...(resultCount !== undefined ? { resultCount } : {}),
                showResultCount,
                ...(className ? { className } : {}),
              })}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </MarketingFilterSidebar>
  );
}
