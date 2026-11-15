/**
 * Where a phone toast sits so it clears the docked bar: the bar's reserved space plus 1rem. The one
 * value for Bid, Shop, art and Account, passed as the toaster's `mobileOffset`. Kept in its own
 * module so root layouts import it by subpath instead of pulling the package barrel.
 */
export const BOTTOM_BAR_TOAST_MOBILE_OFFSET = {
  bottom: "calc(var(--lax-bottom-bar-space, 0px) + 1rem)",
} as const;
