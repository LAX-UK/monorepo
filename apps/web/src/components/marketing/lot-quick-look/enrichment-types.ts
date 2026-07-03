import type { LotQuickLookVM } from "./types";

export type LotQuickLookEnrichment = Partial<
  Pick<
    LotQuickLookVM,
    | "medium"
    | "images"
    | "estimateLabel"
    | "estimateValue"
    | "status"
    | "startTime"
    | "endTime"
    | "currentBidLabel"
    | "currentBidValue"
    | "dimensions"
    | "minNextBidLabel"
    | "minNextBidValue"
    | "buyersPremiumHint"
  >
>;
