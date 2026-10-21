"use client";

import { ARTWORK_OBJECT_TYPE_OPTIONS } from "@/lib/catalogue/artwork-catalogue-filter-config";
import type { ArtworkObjectType } from "@/lib/catalogue/artwork-catalogue-params";
import {
  type SearchAvailability,
  type SearchUrlState,
  searchClearFiltersHref,
  searchFilterHref,
} from "@/lib/search/search-params";
import {
  MARKETING_FILTER_ACCORDION_TRIGGER,
  MARKETING_FILTER_RAIL_IN_SHEET,
  MarketingFilterSheet,
  MarketingFilterSidebar,
  MarketingFilterTrigger,
} from "@auction/marketing-ui";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Draft = {
  availability: SearchAvailability | "";
  objectType: ArtworkObjectType | "";
  minPrice: string;
  maxPrice: string;
};

type Option = { value: string; label: string };

const ANY = "";

const AVAILABILITY_OPTIONS: readonly Option[] = [
  { value: ANY, label: "Any availability" },
  { value: "for_sale", label: "For sale" },
  { value: "price_on_application", label: "Price on request" },
];

const MEDIUM_OPTIONS: readonly Option[] = [
  { value: ANY, label: "Any medium" },
  ...ARTWORK_OBJECT_TYPE_OPTIONS,
];

function draftFromState(state: SearchUrlState): Draft {
  return {
    availability: state.availability ?? "",
    objectType: state.objectType ?? "",
    minPrice: state.minPrice !== undefined ? String(state.minPrice) : "",
    maxPrice: state.maxPrice !== undefined ? String(state.maxPrice) : "",
  };
}

function wholePounds(value: string): number | null {
  return /^\d+$/.test(value) ? Number.parseInt(value, 10) : null;
}

function OptionGroup({
  idPrefix,
  label,
  options,
  value,
  onChange,
}: {
  idPrefix: string;
  label: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <RadioGroup aria-label={label} value={value} onValueChange={onChange} className="gap-0">
      {options.map((option) => {
        const id = `${idPrefix}-${option.value || "any"}`;
        return (
          <div key={id} className="flex min-h-11 items-center gap-3">
            <RadioGroupItem id={id} value={option.value} />
            <Label htmlFor={id} className="flex-1 cursor-pointer py-2 font-body text-sm">
              {option.label}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}

function PriceField({
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
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="font-body text-sm">
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

/** Filters for the artwork tabs: availability (Available only), medium and price. */
export function ArtSearchFilters({
  state,
  activeCount,
}: {
  state: SearchUrlState;
  activeCount: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftFromState(state));
  const showAvailability = state.tab === "available";

  function navigate(href: string) {
    setOpen(false);
    startTransition(() => router.push(href));
  }

  return (
    <MarketingFilterSheet
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(draftFromState(state));
        setOpen(next);
      }}
      title="Filters"
      description="Narrow the artworks that match your search."
      trigger={
        <MarketingFilterTrigger
          activeCount={activeCount}
          className="rounded-none border-0 bg-transparent px-0 font-body text-sm font-medium normal-case tracking-normal"
          data-testid="art-search-filters-trigger"
        />
      }
      applyLabel="Show results"
      onApply={() =>
        navigate(
          searchFilterHref(state, {
            availability: draft.availability || null,
            objectType: draft.objectType || null,
            minPrice: wholePounds(draft.minPrice),
            maxPrice: wholePounds(draft.maxPrice),
          }),
        )
      }
      resetLabel="Reset all"
      onReset={() => navigate(searchClearFiltersHref(state))}
    >
      <MarketingFilterSidebar className={MARKETING_FILTER_RAIL_IN_SHEET}>
        <Accordion
          type="multiple"
          defaultValue={["availability", "objectType", "price"]}
          className="w-full"
        >
          {showAvailability ? (
            <AccordionItem value="availability" className="border-b border-outline-variant">
              <AccordionTrigger className={MARKETING_FILTER_ACCORDION_TRIGGER}>
                Availability
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1">
                <OptionGroup
                  idPrefix="art-search-availability"
                  label="Availability"
                  options={AVAILABILITY_OPTIONS}
                  value={draft.availability}
                  onChange={(value) =>
                    setDraft({ ...draft, availability: value as Draft["availability"] })
                  }
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}
          <AccordionItem value="objectType" className="border-b border-outline-variant">
            <AccordionTrigger className={MARKETING_FILTER_ACCORDION_TRIGGER}>
              Medium
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1">
              <OptionGroup
                idPrefix="art-search-medium"
                label="Medium"
                options={MEDIUM_OPTIONS}
                value={draft.objectType}
                onChange={(value) =>
                  setDraft({ ...draft, objectType: value as Draft["objectType"] })
                }
              />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="price" className="border-b border-outline-variant">
            <AccordionTrigger className={MARKETING_FILTER_ACCORDION_TRIGGER}>
              Price
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-3 pb-4 pt-1">
              <p className="font-body text-xs text-on-surface-variant">
                Applies to works with a listed price. Price-on-request works are excluded from price
                ranges.
              </p>
              <PriceField
                id="art-search-min-price"
                label="Min (£)"
                value={draft.minPrice}
                onChange={(minPrice) => setDraft({ ...draft, minPrice })}
              />
              <PriceField
                id="art-search-max-price"
                label="Max (£)"
                value={draft.maxPrice}
                onChange={(maxPrice) => setDraft({ ...draft, maxPrice })}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </MarketingFilterSidebar>
    </MarketingFilterSheet>
  );
}
