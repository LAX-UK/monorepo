export type SellSpecialist = {
  id: string;
  name: string;
  role: string;
  /** Portrait URL; a person without one is not shown. */
  photoUrl: string;
};

/**
 * The specialists shown on the selling page. Empty until names, roles and photographs are
 * supplied; the section stays hidden while it is.
 */
export const SELL_SPECIALISTS: readonly SellSpecialist[] = [];
