import type { ISaleChannelReader } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";

/**
 * Sets `sellingPlatform` (and `atgAuctionState` for ATG-owned sales) on draft sales, the only
 * status ATG can own. Other statuses skip the lookup, so public reads pay nothing unless a
 * draft is in the result.
 */
export async function withSellingPlatforms<T extends Sale>(
  reader: Pick<ISaleChannelReader, "getSaleOwnerships"> | null | undefined,
  sales: T[],
): Promise<T[]> {
  const draftIds = sales.filter((s) => s.status === "draft").map((s) => s.id);
  if (!reader || draftIds.length === 0) return sales;
  const ownership = await reader.getSaleOwnerships(draftIds);
  return sales.map((s) => {
    const owned = ownership.get(s.id);
    if (!owned) return s;
    if (owned.sellingPlatform !== "atg") return { ...s, sellingPlatform: owned.sellingPlatform };
    return {
      ...s,
      sellingPlatform: "atg",
      atgAuctionState: owned.atgRemoteStatus === "published" ? "live" : "ended",
      atgDistribution: owned.atgDistribution,
    };
  });
}

/** Single-sale form of {@link withSellingPlatforms}. */
export async function withSellingPlatform<T extends Sale>(
  reader: Pick<ISaleChannelReader, "getSaleOwnerships"> | null | undefined,
  sale: T,
): Promise<T> {
  const [withPlatform] = await withSellingPlatforms(reader, [sale]);
  return withPlatform ?? sale;
}

/**
 * Public lot lists: tags draft lots whose sale is ATG-owned with `atgSaleState` (and `atgSold`
 * once ended), so cards can show the ATG state instead of the LAX draft status.
 */
export async function withAtgLotStates<T extends Lot>(
  reader: Pick<ISaleChannelReader, "getSaleOwnerships" | "getSoldLotIds"> | null | undefined,
  lots: T[],
): Promise<T[]> {
  const saleIds = [
    ...new Set(lots.flatMap((l) => (l.status === "draft" && l.saleId ? [l.saleId] : []))),
  ];
  if (!reader || saleIds.length === 0) return lots;
  const ownership = await reader.getSaleOwnerships(saleIds);
  const states = new Map<string, "live" | "ended">();
  for (const [saleId, owned] of ownership) {
    if (owned.sellingPlatform !== "atg") continue;
    states.set(saleId, owned.atgRemoteStatus === "published" ? "live" : "ended");
  }
  if (states.size === 0) return lots;
  const endedSaleIds = [...states].filter(([, s]) => s === "ended").map(([id]) => id);
  const soldSets = await Promise.all(endedSaleIds.map((id) => reader.getSoldLotIds(id)));
  const sold = new Set(soldSets.flatMap((set) => [...set]));
  return lots.map((lot) => {
    const state = lot.status === "draft" && lot.saleId ? states.get(lot.saleId) : undefined;
    if (!state) return lot;
    return state === "live"
      ? { ...lot, atgSaleState: state }
      : { ...lot, atgSaleState: state, atgSold: sold.has(lot.id) };
  });
}

/** Adds `atgSold` to lots of a sale whose ATG auction has ended. */
export async function withAtgLotResults<T extends Lot>(
  reader: Pick<ISaleChannelReader, "getSoldLotIds"> | null | undefined,
  sale: Pick<Sale, "id" | "atgAuctionState">,
  lots: T[],
): Promise<T[]> {
  if (!reader || sale.atgAuctionState !== "ended" || lots.length === 0) return lots;
  const sold = await reader.getSoldLotIds(sale.id);
  return lots.map((lot) => ({ ...lot, atgSold: sold.has(lot.id) }));
}
