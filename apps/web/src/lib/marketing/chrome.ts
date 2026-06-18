/** Single focus ring for marketing chrome + link-cards (see `docs/marketing-design-language.md`). */
export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Focus-within ring for card-as-link shells (nested interactive children). */
export const FOCUS_WITHIN_RING =
  "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring";

/** Card lift + hover ring — shared interaction vocabulary for marketing link cards. */
export const MARKETING_CARD_LIFT =
  "motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none motion-safe:hover:-translate-y-px motion-safe:hover:ring-1 motion-safe:hover:ring-primary/20";

/** Image scale on card hover. */
export const MARKETING_CARD_MEDIA_HOVER =
  "motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:scale-[1.02] motion-reduce:group-hover:scale-100";

/** Inline text link inside prose / legal / content pages (midnight brand, underline-on-hover). */
export const MARKETING_PROSE_LINK = `rounded-sm text-link underline-offset-4 hover:underline ${FOCUS_RING}`;

/** Standard inline link — admin, dashboard, auth (midnight). */
export const INLINE_LINK = `text-link underline-offset-4 hover:underline ${FOCUS_RING}`;

/** Uppercase label-style action link (midnight secondary brand). */
export const LABEL_LINK =
  "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary hover:underline";

/** Horizontal padding rhythm shared by all marketing shells. */
export const MARKETING_PAGE_GUTTER_X = "px-8 md:px-10 lg:px-14";

/** Centered full-width column with standard horizontal gutters. */
export const MARKETING_PAGE_GUTTER = `mx-auto w-full ${MARKETING_PAGE_GUTTER_X}`;

/** Outer marketing column. */
export const MARKETING_PAGE_SHELL = `${MARKETING_PAGE_GUTTER} max-w-[var(--container-max,1440px)]`;

/** Inner reading / catalogue column. */
export const MARKETING_PAGE_INNER = `${MARKETING_PAGE_GUTTER} max-w-[var(--container-inner,1376px)]`;

/** Catalogue toolbar / rail horizontal rhythm (matches page inner). */
export const MARKETING_CATALOG_GUTTER = MARKETING_PAGE_GUTTER;

/** Top padding for catalogue hubs with sticky toolbars (aligns with site header). */
export const MARKETING_CATALOG_PT = "pt-[var(--header-height)]";

/** Shared list-view band shell (search, archive, catalogue list). */
export const MARKETING_CATALOG_LIST_SHELL =
  "mx-auto max-w-[var(--container-inner,1376px)] border-y border-border-hairline bg-surface-container-lowest sm:rounded-xl sm:border sm:border-border-hairline";

/** Two-column catalogue hub: filter rail (16–18rem) + flexible main (`/artists`, `/sales`). */
export const MARKETING_CATALOG_FILTER_GRID =
  "grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10";

/** First grid column: filter rail slot (hidden below `lg`). */
export const MARKETING_CATALOG_FILTER_RAIL_SLOT = "hidden lg:block";

/** Second grid column: catalogue results (grid, list, calendar). */
export const MARKETING_CATALOG_MAIN_COLUMN = "min-w-0";
