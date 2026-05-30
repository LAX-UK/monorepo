import { type LotDetailContext, fetchLotDetailContext } from "@/lib/admin/lot-detail-context";
import { getAdminLotById } from "@/lib/data/http/admin.server";
import type { Lot } from "@auction/types";
import { notFound } from "next/navigation";
import { cache } from "react";

export type AdminLotDetailBundle = {
  auction: Lot;
  context: LotDetailContext;
};

/** Deduped lot record fetch for edit routes (no detail context). */
export const loadAdminLotRecord = cache(async (lotId: string): Promise<Lot> => {
  const auction = await getAdminLotById(lotId).catch(() => null);
  if (!auction) notFound();
  return auction;
});

/** Deduped lot fetch for layout + tab routes. */
export const loadAdminLotDetail = cache(async (lotId: string): Promise<AdminLotDetailBundle> => {
  const auction = await getAdminLotById(lotId).catch(() => null);
  if (!auction) notFound();
  const context = await fetchLotDetailContext(auction);
  return { auction, context };
});
