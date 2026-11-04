/** The element id of the hero action row the sale's phone bar stands in for. */
export const SALE_HERO_ACTIONS_ID = "sale-hero-actions";

/**
 * Whether the sale's phone bar shows. While the hero's actions are on screen the bar would repeat
 * them, so it waits until they scroll out. A sale with no such row (ended, or handled elsewhere) has
 * nothing for the bar to stand in for, so it shows at once. Before the page has been read
 * (`heroActionsPresent` unknown) it stays hidden, so it never flashes in and out.
 */
export function shouldShowSalePhoneBar(input: {
  heroActionsPresent: boolean | null;
  heroActionsOutOfView: boolean;
}): boolean {
  if (input.heroActionsPresent === null) return false;
  if (!input.heroActionsPresent) return true;
  return input.heroActionsOutOfView;
}
