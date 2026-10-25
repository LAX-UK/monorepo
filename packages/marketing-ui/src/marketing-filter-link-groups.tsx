import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { MARKETING_FILTER_GROUP_TITLE, marketingFilterRailLink } from "./catalog-filter-rail.js";

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
 * Filter groups as plain links, so filtering works without JavaScript and stays crawlable.
 * Used by the desktop rail and the mobile filter sheet.
 */
export function MarketingFilterLinkGroups({
  groups,
  clearHref,
  hasFilters = false,
  idPrefix = "filter",
  className,
}: MarketingFilterLinkGroupsProps) {
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
              <h3 id={headingId} className={MARKETING_FILTER_GROUP_TITLE}>
                {group.title}
              </h3>
              <ul className="flex flex-col gap-0.5">
                {group.links.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <Link
                      href={link.href}
                      aria-current={link.active ? "page" : undefined}
                      className={cn(
                        marketingFilterRailLink(link.active),
                        "min-h-9 justify-between gap-2",
                      )}
                    >
                      <span>{link.label}</span>
                      {typeof link.count === "number" ? (
                        <span className="font-body text-xs tabular-nums text-on-surface-variant">
                          {link.count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
    </div>
  );
}
