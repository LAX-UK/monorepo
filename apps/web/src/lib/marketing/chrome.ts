/** Single focus ring for marketing chrome + link-cards (see `docs/marketing-design-language.md`). */
export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Inline text link inside prose / legal / content pages (midnight brand, underline-on-hover). */
export const MARKETING_PROSE_LINK = `rounded-sm text-link underline-offset-4 hover:underline ${FOCUS_RING}`;

/** Standard inline link — admin, dashboard, auth (midnight). */
export const INLINE_LINK = `text-link underline-offset-4 hover:underline ${FOCUS_RING}`;

/** Uppercase label-style action link (midnight secondary brand). */
export const LABEL_LINK =
  "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary hover:underline";

/** Horizontal padding rhythm shared by all marketing shells. */
const MARKETING_PAGE_GUTTER = "mx-auto w-full px-8 md:px-10 lg:px-14";

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
