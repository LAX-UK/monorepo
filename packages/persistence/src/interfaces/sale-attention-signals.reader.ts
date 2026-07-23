import type { SaleAttentionSignalKey, SaleAttentionSignals } from "@auction/domain";

export type { SaleAttentionSignalKey, SaleAttentionSignals };

export interface ISaleAttentionSignalsReader {
  load(saleId: string, needs: readonly SaleAttentionSignalKey[]): Promise<SaleAttentionSignals>;
}
