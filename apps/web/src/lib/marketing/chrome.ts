/** Shared interaction tokens — SSOT in `@auction/branding` (see `docs/marketing-design-language.md`). */
export {
  FOCUS_RING,
  FOCUS_WITHIN_RING,
  INLINE_LINK,
  LABEL_LINK,
  MARKETING_CARD_LIFT,
  MARKETING_CARD_MEDIA_HOVER,
  MARKETING_CATALOG_FILTER_GRID,
  MARKETING_CATALOG_FILTER_RAIL_SLOT,
  MARKETING_CATALOG_GUTTER,
  MARKETING_CATALOG_LIST_SHELL,
  MARKETING_CATALOG_MAIN_COLUMN,
  MARKETING_CATALOG_PT,
  MARKETING_LIST_TOOLBAR_BLEED,
  MARKETING_PAGE_GUTTER,
  MARKETING_PAGE_GUTTER_X,
  MARKETING_PAGE_INNER,
  MARKETING_PAGE_SHELL,
  MARKETING_PROSE_LINK,
} from "@auction/branding";

/** Sticky `SaleAnchorTabs` bar height (`min-h-11` = 2.75rem). */
export const SALE_ANCHOR_BAR_HEIGHT = "2.75rem";

/** Sticky anchor tab bar — sits below site header. */
export const SALE_ANCHOR_STICKY_CLASS = "sticky top-[var(--header-height)] z-[var(--z-sticky,30)]";

/** Catalogue toolbar offset — stacks below anchor tabs on sale detail pages. */
export const SALE_CATALOG_TOOLBAR_STICKY_TOP = `top-[calc(var(--header-height,4rem)+${SALE_ANCHOR_BAR_HEIGHT})]`;

/** Scroll margin for `#catalog` / `#overview` anchor targets (header + anchor bar). */
export const SALE_SECTION_SCROLL_MT = `scroll-mt-[calc(var(--header-height,4rem)+${SALE_ANCHOR_BAR_HEIGHT})]`;
