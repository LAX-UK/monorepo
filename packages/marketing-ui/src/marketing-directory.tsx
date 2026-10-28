import {
  MARKETING_CATALOG_FILTER_GRID,
  MARKETING_CATALOG_FILTER_RAIL_SLOT,
  MARKETING_CATALOG_MAIN_COLUMN,
  MARKETING_CATALOG_PT,
  MARKETING_PAGE_SHELL,
} from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import type { ReactNode } from "react";
import { MARKETING_FILTER_RAIL_STICKY } from "./catalog-filter-rail.js";
import { MarketingFilterSidebar } from "./marketing-filter-sidebar.js";

export type MarketingDirectoryHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Breadcrumb or back link above the title. */
  breadcrumb?: ReactNode;
  /** `MarketingDirectorySearch`. */
  search?: ReactNode;
  /** Scenario chips, e.g. Featured / Living artists. */
  chips?: ReactNode;
  /** `MarketingAlphabetFilter`. */
  letterBar?: ReactNode;
};

/** Title band of a directory page: title, introduction, search, chips and the A–Z bar. */
export function MarketingDirectoryHeader({
  title,
  description,
  breadcrumb,
  search,
  chips,
  letterBar,
}: MarketingDirectoryHeaderProps) {
  return (
    <header
      className="border-b border-border-hairline bg-surface-container-lowest/40 py-8 sm:py-10 md:py-12"
      data-testid="marketing-directory-header"
    >
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-6")}>
        <div className="flex flex-col gap-3">
          {breadcrumb}
          <h1 className="text-balance font-headline text-[length:clamp(2rem,4.2vw,3.5rem)] font-semibold leading-[1.1] tracking-tight text-on-surface">
            {title}
          </h1>
          {description ? (
            <div className="max-w-2xl font-body text-base leading-7 text-on-surface-variant md:text-lg">
              {description}
            </div>
          ) : null}
        </div>
        {search ? <div className="max-w-2xl">{search}</div> : null}
        {chips}
        {letterBar}
      </div>
    </header>
  );
}

export type MarketingDirectorySearchProps = {
  action: string;
  label: string;
  placeholder?: string;
  defaultValue?: string | undefined;
  /** Query values kept when searching (sort, view and similar). */
  hidden?: Readonly<Record<string, string | undefined>>;
  name?: string;
};

/** GET search form for directories; works without JavaScript. */
export function MarketingDirectorySearch({
  action,
  label,
  placeholder,
  defaultValue,
  hidden = {},
  name = "q",
}: MarketingDirectorySearchProps) {
  const inputId = `directory-search-${name}`;
  return (
    <form method="get" action={action} className="flex flex-col gap-2">
      <label htmlFor={inputId} className="font-body text-sm font-medium text-on-surface">
        {label}
      </label>
      {Object.entries(hidden).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}
      <div className="flex items-stretch gap-2">
        <Input
          id={inputId}
          type="search"
          name={name}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-md border border-input-border bg-surface px-4 text-base md:text-base"
        />
        <Button type="submit" className="h-11 shrink-0 px-5 sm:px-8">
          Search
        </Button>
      </div>
    </form>
  );
}

export type MarketingDirectoryProps = {
  header: ReactNode;
  /** Desktop filter rail content (`MarketingFilterLinkGroups`). */
  rail?: ReactNode;
  railLabel?: string;
  /** `MarketingListToolbar` with count, sort and the mobile filter sheet. */
  toolbar?: ReactNode;
  /** Removable active filter chips. */
  activeFilters?: ReactNode;
  /** Results, or the empty or error state. */
  children: ReactNode;
  /** Pagination, then any closing promotion. */
  footer?: ReactNode;
  /** Head scripts such as JSON-LD. */
  jsonLd?: ReactNode;
  /** `main` when the app layout has no `<main>` of its own. */
  as?: "main" | "div";
  className?: string;
};

/**
 * Directory page layout shared by LAX Bid, LAX Shop and lax.art: title band, then a sticky
 * filter rail beside the results on desktop. Below `lg` the rail moves into the toolbar's
 * filter sheet.
 */
export function MarketingDirectory({
  header,
  rail,
  railLabel = "Filters",
  toolbar,
  activeFilters,
  children,
  footer,
  jsonLd,
  as: Tag = "div",
  className,
}: MarketingDirectoryProps) {
  return (
    <Tag
      {...(Tag === "main" ? { id: "main-content" } : {})}
      className={cn(
        "bg-page-bg pb-[var(--page-bottom-padding,4rem)] text-on-surface dark:bg-background",
        Tag === "main" && MARKETING_CATALOG_PT,
        "overflow-x-clip",
        className,
      )}
    >
      {jsonLd}
      {header}
      <div className={cn(MARKETING_PAGE_SHELL, "py-8 sm:py-10 lg:py-12")}>
        <div className={rail ? MARKETING_CATALOG_FILTER_GRID : undefined}>
          {rail ? (
            <div className={MARKETING_CATALOG_FILTER_RAIL_SLOT}>
              <MarketingFilterSidebar
                aria-label={railLabel}
                className={MARKETING_FILTER_RAIL_STICKY}
              >
                {rail}
              </MarketingFilterSidebar>
            </div>
          ) : null}
          <div className={cn(MARKETING_CATALOG_MAIN_COLUMN, "flex flex-col gap-6")}>
            {toolbar}
            {activeFilters}
            {children}
            {footer}
          </div>
        </div>
      </div>
    </Tag>
  );
}
