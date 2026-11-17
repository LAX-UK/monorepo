import type { ReactNode } from "react";

/**
 * The two controls a lot card carries besides its links, each placed by the card: the save heart
 * at the end of the "Lot N" line, and the quick look label at the bottom of the picture (desktop
 * hover and keyboard focus only). Nothing else sits on the picture but the sale status pill.
 */
export type LotCardExtras = {
  save?: ReactNode;
  quickLook?: ReactNode;
};
