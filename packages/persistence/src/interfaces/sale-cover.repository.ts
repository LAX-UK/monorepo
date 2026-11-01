import type { SaleCoverSlot, SaleCoverSlotName, SaleCoverSlots, SaleStatus } from "@auction/types";

export type SaleCoverState = {
  id: string;
  status: SaleStatus;
  /** The old positional array, still read for any slot staff have not set. */
  coverImages: string[];
  coverSlots: SaleCoverSlots;
};

export type SaleHomePatch = {
  subtitle?: string | null;
  featuredLotIds?: string[];
  consignmentDeadline?: Date | null;
};

export type SaleHomeState = {
  subtitle: string | null;
  featuredLotIds: string[];
  consignmentDeadline: Date | null;
  homePinOrder: number | null;
};

/** The staff-chosen cover and home fields of a sale, and the lookups their rules need. */
export interface ISaleCoverRepository {
  /** The sale's cover state, or null when it does not exist or was deleted. */
  getState(saleId: string): Promise<SaleCoverState | null>;
  /** Sets one slot without touching the others. */
  setSlot(saleId: string, name: SaleCoverSlotName, slot: SaleCoverSlot): Promise<void>;
  clearSlot(saleId: string, name: SaleCoverSlotName): Promise<void>;
  getHome(saleId: string): Promise<SaleHomeState | null>;
  updateHome(saleId: string, patch: SaleHomePatch): Promise<void>;
  /** Ids of the sale's lots that are not deleted. */
  listLotIds(saleId: string): Promise<Set<string>>;
  /** The photographs of a lot and the sale it is in, or null when the lot does not exist. */
  getLotImages(lotId: string): Promise<{ saleId: string | null; images: string[] } | null>;
  getSaleStatuses(saleIds: readonly string[]): Promise<Map<string, SaleStatus>>;
  /** Replaces the home pins: the given sales hold places 1, 2, 3 in order; all others are unpinned. */
  replaceHomePins(saleIds: readonly string[]): Promise<void>;
}
