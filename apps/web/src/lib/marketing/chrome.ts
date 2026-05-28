/** Single focus ring for marketing chrome + link-cards (see `docs/marketing-design-language.md`). */
export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

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
