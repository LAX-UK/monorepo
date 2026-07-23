import type { CapabilityRequirement } from "@auction/types";
import type { SaleStatus } from "@auction/types";
import type {
  SaleAttentionItem,
  SaleAttentionSignalKey,
  SaleAttentionSignals,
} from "./sale-attention-types.js";

export interface SaleAttentionContributor {
  readonly id: string;
  readonly requiredCapability?: CapabilityRequirement;
  readonly needs: readonly SaleAttentionSignalKey[];
  appliesTo(status: SaleStatus): boolean;
  evaluate(signals: SaleAttentionSignals): SaleAttentionItem[];
}
