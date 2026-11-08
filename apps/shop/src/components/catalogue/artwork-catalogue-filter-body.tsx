"use client";

import { ARTWORK_FILTER_DEFAULT_OPEN } from "@/lib/catalogue/artwork-catalogue-filter-config";
import type { CatalogueFilterRailVm } from "@/lib/catalogue/catalogue-filter-groups";
import type { CatalogueSortVm } from "@/lib/catalogue/catalogue-sort";
import {
  MarketingFilterAccordionSection,
  MarketingFilterLinkRow,
  MarketingFilterSidebar,
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
            <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
              <legend className="sr-only">Sort</legend>
              {sort.options.map((option) => (
                <MarketingFilterLinkRow
                  key={option.value}
                  kind="radio"
                  label={option.label}
                  checked={option.value === sort.current.value}
                  // The current sort stays chosen: a sort cannot be taken off.
                  href={option.value === sort.current.value ? sort.current.href : option.href}
                  dense
                />
              ))}
            </fieldset>
          </MarketingFilterAccordionSection>
        ) : null}
        {rail.groups.map((group) => (
          <MarketingFilterAccordionSection key={group.key} value={group.key} title={group.title}>
            <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
              <legend className="sr-only">{group.title}</legend>
              {group.options.map((option) => (
                <MarketingFilterLinkRow
                  key={option.value}
                  kind="checkbox"
                  label={option.label}
                  count={option.count}
                  checked={option.active}
                  href={option.href}
                  dense
                />
              ))}
            </fieldset>
          </MarketingFilterAccordionSection>
        ))}
      </Accordion>
    </MarketingFilterSidebar>
  );
}
