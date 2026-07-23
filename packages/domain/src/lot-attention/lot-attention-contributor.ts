import type { LotAttentionItem, LotAttentionSignals } from "./lot-attention-types.js";

export type LotAttentionContributor = {
  id: string;
  appliesTo: (status: string) => boolean;
  evaluate: (signals: LotAttentionSignals) => LotAttentionItem[];
};
