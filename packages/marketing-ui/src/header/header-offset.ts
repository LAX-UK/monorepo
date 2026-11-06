/** Full header height, the content offset at the top of a page. Published on the root. */
export const HEADER_HEIGHT_VAR = "--header-height";

/** How far the header has slid up as the LAX top bar scrolls away. Published on the root. */
export const TOP_BAR_SHIFT_VAR = "--lax-top-bar-shift";

/** Where the visible header ends: the full height less the slid-away top bar. Published on the root. */
export const HEADER_OFFSET_VAR = "--header-offset";

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
  root.style.setProperty(HEADER_HEIGHT_VAR, `${vars.height}px`);
  root.style.setProperty(TOP_BAR_SHIFT_VAR, `${vars.shift}px`);
  root.style.setProperty(HEADER_OFFSET_VAR, `${vars.height - vars.shift}px`);
}
