"use client";

import { ARTWORK_FILTER_DEFAULT_OPEN } from "@/lib/catalogue/artwork-catalogue-filter-config";
import type {
  CatalogueFilterOptionVm,
  CatalogueFilterRailVm,
} from "@/lib/catalogue/catalogue-filter-groups";
import type { CatalogueSortVm } from "@/lib/catalogue/catalogue-sort";
import {
  MarketingFilterAccordionSection,
  MarketingFilterSidebar,
  marketingFilterRailLink,
} from "@auction/marketing-ui";
import { Accordion, Switch, cn } from "@auction/ui";
import { useId, useState } from "react";

type Props = {
  rail: CatalogueFilterRailVm;
  /** The sort choices, in the phone sheet only; on larger screens sort sits above the results. */
  sort?: CatalogueSortVm;
  onNavigate: (href: string) => void;
  pending?: boolean;
  className?: string;
};

/** One rail option: the label, then its count. Choosing an applied option takes it off. */
function RailOption({
  option,
  noun,
  pending,
  onNavigate,
}: {
  option: Pick<CatalogueFilterOptionVm, "label" | "count" | "active" | "href">;
  noun: { one: string; other: string };
  pending: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={option.active}
      disabled={pending}
      className={cn(marketingFilterRailLink(option.active), "shop-filter-option")}
      onClick={() => onNavigate(option.href)}
    >
      <span className="shop-filter-option__label">{option.label}</span>
      {option.count !== undefined ? (
        <span className="shop-filter-option__count">
          <span aria-hidden="true">{option.count}</span>
          <span className="sr-only">
            , {option.count} {option.count === 1 ? noun.one : noun.other}
          </span>
        </span>
      ) : null}
    </button>
  );
}

const EDITIONS = { one: "edition", other: "editions" };

function AvailabilitySwitch({
  availability,
  pending,
  onNavigate,
}: {
  availability: NonNullable<CatalogueFilterRailVm["availability"]>;
  pending: boolean;
  onNavigate: (href: string) => void;
}) {
  const id = useId();
  return (
    <div className="shop-filter-switch">
      <div className="shop-filter-switch__text">
        <label htmlFor={`${id}-switch`} className="shop-filter-switch__label">
          Available only
        </label>
        <p id={`${id}-hint`} className="shop-filter-switch__hint">
          Hide sold-out editions
        </p>
      </div>
      <Switch
        id={`${id}-switch`}
        aria-describedby={`${id}-hint`}
        checked={availability.checked}
        disabled={pending}
        onCheckedChange={() => onNavigate(availability.href)}
        className="shop-filter-switch__control"
      />
    </div>
  );
}

/**
 * The catalogue's filters, for the rail and the phone sheet: the "Available only" switch, then a
 * collapsible group per facet with a count beside each option. Groups with nothing to choose
 * between are left out before they get here.
 */
export function ArtworkCatalogueFilterBody({
  rail,
  sort,
  onNavigate,
  pending = false,
  className,
}: Props) {
  const [openSections, setOpenSections] = useState<string[]>([
    "sort",
    ...ARTWORK_FILTER_DEFAULT_OPEN,
  ]);

  return (
    <MarketingFilterSidebar
      className={cn("shop-filter-rail space-y-0 pb-0", className)}
      aria-label="Filters"
    >
      {rail.availability ? (
        <AvailabilitySwitch
          availability={rail.availability}
          pending={pending}
          onNavigate={onNavigate}
        />
      ) : null}
      <Accordion
        type="multiple"
        className="w-full"
        value={openSections}
        onValueChange={setOpenSections}
      >
        {sort ? (
          <MarketingFilterAccordionSection value="sort" title="Sort">
            <div className="flex flex-col gap-1">
              {sort.options.map((option) => (
                <RailOption
                  key={option.value}
                  option={{
                    label: option.label,
                    active: option.value === sort.current.value,
                    // The current sort stays chosen: a sort cannot be taken off.
                    href: option.value === sort.current.value ? sort.current.href : option.href,
                  }}
                  noun={EDITIONS}
                  pending={pending}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </MarketingFilterAccordionSection>
        ) : null}
        {rail.groups.map((group) => (
          <MarketingFilterAccordionSection key={group.key} value={group.key} title={group.title}>
            <div className="flex flex-col gap-1">
              {group.options.map((option) => (
                <RailOption
                  key={option.value}
                  option={option}
                  noun={EDITIONS}
                  pending={pending}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </MarketingFilterAccordionSection>
        ))}
      </Accordion>
    </MarketingFilterSidebar>
  );
}
