/** Approximate height of `AdminDetailTabs` tab list (triggers + border). */
export const ADMIN_TAB_BAR_HEIGHT = "2.75rem";

/** Height reserved when `DashboardDetailHeader` is sticky below the shell header. */
export const ADMIN_DETAIL_HEADER_OFFSET = "3.5rem";

type StickyTopOptions = {
  /** When true, offset includes the sticky detail header band below the shell header. */
  detailHeaderSticky?: boolean;
};

function shellTop(mobile = true): string {
  return mobile ? "var(--header-height-mobile,56px)" : "var(--header-height-shell,52px)";
}

/** Sticky `top` for the main admin detail tab list. */
export function adminDetailTabsStickyTop({
  detailHeaderSticky = false,
}: StickyTopOptions = {}): string {
  const detailOffset = detailHeaderSticky ? ` + ${ADMIN_DETAIL_HEADER_OFFSET}` : "";
  return [
    `top-[calc(${shellTop(true)}${detailOffset})]`,
    `md:top-[calc(${shellTop(false)}${detailOffset})]`,
  ].join(" ");
}

/** Sticky `top` for a secondary nav row below the tab list (e.g. overview section anchors). */
export function adminOverviewSubnavStickyTop({
  detailHeaderSticky = false,
}: StickyTopOptions = {}): string {
  const detailOffset = detailHeaderSticky ? ` + ${ADMIN_DETAIL_HEADER_OFFSET}` : "";
  const tabOffset = ` + ${ADMIN_TAB_BAR_HEIGHT}`;
  return [
    `top-[calc(${shellTop(true)}${detailOffset}${tabOffset})]`,
    `md:top-[calc(${shellTop(false)}${detailOffset}${tabOffset})]`,
  ].join(" ");
}
