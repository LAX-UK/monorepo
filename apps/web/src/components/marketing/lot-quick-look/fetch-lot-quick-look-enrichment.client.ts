import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseLotDetail } from "@/lib/data/http/parse";
import type { LotQuickLookEnrichment } from "./enrichment-types";
import { lotQuickLookEnrichmentFromLot } from "./lot-quick-look-enrichment";
import type { LotQuickLookVM } from "./types";

export type { LotQuickLookEnrichment } from "./enrichment-types";

/** Background fetch for extra images, medium, and pricing when absent on the card VM. */
export async function fetchLotQuickLookEnrichment(
  lotId: string,
): Promise<LotQuickLookEnrichment | null> {
  try {
    const res = await getBrowserHc().lots[":id"].$get({ param: { id: lotId } });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: unknown };
    const lot = parseLotDetail(body.data);
    return lotQuickLookEnrichmentFromLot(lot);
  } catch {
    return null;
  }
}

export function mergeLotQuickLookEnrichment(
  vm: LotQuickLookVM,
  enrichment: LotQuickLookEnrichment | null,
): LotQuickLookVM {
  if (!enrichment) return vm;
  return {
    ...vm,
    ...(enrichment.status ? { status: enrichment.status } : {}),
    ...(enrichment.startTime ? { startTime: enrichment.startTime } : {}),
    ...(enrichment.endTime ? { endTime: enrichment.endTime } : {}),
    ...(enrichment.medium ? { medium: enrichment.medium } : {}),
    ...(enrichment.images?.length ? { images: enrichment.images } : {}),
    ...(!vm.estimateValue && enrichment.estimateValue
      ? { estimateLabel: enrichment.estimateLabel, estimateValue: enrichment.estimateValue }
      : {}),
    ...(enrichment.currentBidLabel
      ? {
          currentBidLabel: enrichment.currentBidLabel,
          currentBidValue: enrichment.currentBidValue,
        }
      : {}),
    ...(enrichment.minNextBidLabel
      ? {
          minNextBidLabel: enrichment.minNextBidLabel,
          minNextBidValue: enrichment.minNextBidValue,
        }
      : {}),
    ...(enrichment.dimensions ? { dimensions: enrichment.dimensions } : {}),
    ...(enrichment.buyersPremiumHint ? { buyersPremiumHint: enrichment.buyersPremiumHint } : {}),
  };
}
