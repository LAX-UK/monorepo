import { type LotDetailContext, fetchLotDetailContext } from "@/lib/admin/lot-detail-context";
import { type LotDeleteEligibility, getAdminLotDetail } from "@/lib/data/http/admin.server";
import type { Lot } from "@auction/types";
import { notFound } from "next/navigation";
import { cache } from "react";

export type AdminLotDetailBundle = {
  auction: Lot;
  context: LotDetailContext;
  deleteEligibility?: LotDeleteEligibility | null;
};

/** Deduped lot record fetch for edit routes (no detail context). */
export const loadAdminLotRecord = cache(async (lotId: string): Promise<Lot> => {
  const detail = await getAdminLotDetail(lotId).catch(() => null);
  if (!detail) notFound();
  return detail.auction;
});

/** Deduped lot fetch for layout + tab routes. */
export const loadAdminLotDetail = cache(async (lotId: string): Promise<AdminLotDetailBundle> => {
  const detail = await getAdminLotDetail(lotId).catch(() => null);
  if (!detail) notFound();
  const context = await fetchLotDetailContext(detail.auction);
  return {
    auction: detail.auction,
    context,
    deleteEligibility: detail.deleteEligibility,
  };
});

export type { LotDeleteEligibility };
