/** Full header height (with any connectivity banner), the content offset at the top of a page. Published on the root. */
export const HEADER_HEIGHT_VAR = "--header-height";

/** How far the header has slid up as the LAX top bar scrolls away. Published on the root. */
export const TOP_BAR_SHIFT_VAR = "--lax-top-bar-shift";

/** Where the visible header chrome ends: the full height less the slid-away top bar. Published on the root. */
export const HEADER_OFFSET_VAR = "--header-offset";

/**
 * Height of a connectivity banner showing under the header (0 or unset when none shows). The
 * banner is part of the header chrome: `--header-height` and `--header-offset` include it, so page
 * offsets, sticky bars and scroll margins clear the banner without knowing about it.
 */
export const CONNECTIVITY_BANNER_HEIGHT_VAR = "--connectivity-banner-height";

/** Where the header element itself ends, without the banner: the banner's own `top`. Published on the root. */
export const HEADER_BAR_OFFSET_VAR = "--header-bar-offset";

/** Selector of the LAX top bar inside the header; its height is how far the header can slide. */
export const TOP_BAR_SELECTOR = '[data-testid="lax-family-bar"]';

/** The header slides up with the page by at most the top bar's height. */
export function topBarShift(scrollY: number, topBarHeight: number): number {
  return Math.min(Math.max(scrollY, 0), topBarHeight);
}

/** Writes the header variables on the root element so pages, sticky bars and banners share them. */
export function publishHeaderVars(
  root: HTMLElement,
  vars: { height: number; shift: number },
): void {
  const offset = vars.height - vars.shift;
  const withBanner = (px: number) => `calc(${px}px + var(${CONNECTIVITY_BANNER_HEIGHT_VAR}, 0px))`;
  root.style.setProperty(HEADER_HEIGHT_VAR, withBanner(vars.height));
  root.style.setProperty(TOP_BAR_SHIFT_VAR, `${vars.shift}px`);
  root.style.setProperty(HEADER_OFFSET_VAR, withBanner(offset));
  root.style.setProperty(HEADER_BAR_OFFSET_VAR, `${offset}px`);
}
