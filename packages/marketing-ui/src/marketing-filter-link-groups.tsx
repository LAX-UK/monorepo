"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { RadioGroup } from "@auction/ui/components/radio-group";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MARKETING_FILTER_GROUP_TITLE } from "./catalog-filter-rail.js";
import { MarketingFilterCheckboxRow } from "./marketing-filter-checkbox-row.js";
import { MarketingFilterRadioRow } from "./marketing-filter-radio-row.js";

/**
 * One option. `href` is where choosing the option goes: when it is `active`, the address with it
 * taken off, so the row works as a checkbox.
 */
export type MarketingFilterLink = {
  label: string;
  href: string;
  count?: number | undefined;
  active: boolean;
};

export type MarketingFilterLinkGroup = {
  id: string;
  title: string;
  links: readonly MarketingFilterLink[];
  /**
   * `single` is a choice of one, such as a sort order: radios, where the chosen option cannot be
   * taken off. The default is checkboxes, where choosing an applied option takes it off.
   */
  selection?: "multiple" | "single";
};

export type MarketingFilterLinkGroupsProps = {
  groups: readonly MarketingFilterLinkGroup[];
  /** "Clear all filters" target, shown while a filter is applied. */
  clearHref?: string | undefined;
  hasFilters?: boolean | undefined;
  /** Prefix for heading ids, so the rail and the sheet can both be on the page. */
  idPrefix?: string;
  className?: string;
};

/**
 * Filter groups as checkbox rows with counts. Choosing a row opens its address, so the URL stays
 * the one source of the applied filters. Used by the desktop rail and the mobile filter sheet.
 */
export function MarketingFilterLinkGroups({
  groups,
  clearHref,
  hasFilters = false,
  idPrefix = "filter",
  className,
}: MarketingFilterLinkGroupsProps) {
  const router = useRouter();
  return (
    <div className={cn("flex flex-col gap-7", className)}>
      {hasFilters && clearHref ? (
        <Link
          href={clearHref}
          className={cn(
            "inline-flex min-h-6 w-fit items-center rounded-sm font-body text-sm font-medium text-link underline-offset-4 hover:underline",
            FOCUS_RING,
          )}
        >
          Clear all filters
        </Link>
      ) : null}
      {groups
        .filter((group) => group.links.length > 0)
        .map((group) => {
          const headingId = `${idPrefix}-${group.id}`;
          return (
            <section key={group.id} aria-labelledby={headingId}>
              <h2 id={headingId} className={MARKETING_FILTER_GROUP_TITLE}>
                {group.title}
              </h2>
              {group.selection === "single" ? (
                <RadioGroup
                  aria-labelledby={headingId}
                  value={String(group.links.findIndex((link) => link.active))}
                  onValueChange={(index) => {
                    const link = group.links[Number(index)];
                    if (link) router.push(link.href, { scroll: false });
                  }}
                  className="gap-0"
                >
                  {group.links.map((link, index) => (
                    <MarketingFilterRadioRow
                      key={`${link.label}-${link.href}`}
                      id={`${headingId}-${index}`}
                      value={String(index)}
                      label={link.label}
                      count={link.count}
                      checked={link.active}
                      dense
                    />
                  ))}
                </RadioGroup>
              ) : (
                <ul className="flex flex-col">
                  {group.links.map((link, index) => (
                    <li key={`${link.label}-${link.href}`}>
                      <MarketingFilterCheckboxRow
                        id={`${headingId}-${index}`}
                        label={link.label}
                        count={link.count}
                        checked={link.active}
                        dense
                        onCheckedChange={() => router.push(link.href, { scroll: false })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
    </div>
  );
}
