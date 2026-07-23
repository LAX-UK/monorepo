import type { LotAttentionContributor } from "./lot-attention-contributor.js";

export const setupReadinessContributor: LotAttentionContributor = {
  id: "setup-readiness",
  appliesTo: (status) => status === "draft",
  evaluate(signals) {
    const lot = signals.lot;
    if (!lot) return [];
    const percent = signals.publishReadinessPercent;
    if (percent == null || percent >= 100) return [];
    return [
      {
        id: "setup-readiness",
        kind: "setup_readiness",
        category: "Setup",
        severity: "high",
        count: 1,
        target: { tab: "overview" },
      },
    ];
  },
};

export const connectContributor: LotAttentionContributor = {
  id: "connect",
  appliesTo: (status) => status === "draft" || status === "scheduled",
  evaluate(signals) {
    if (!signals.connectRequired) return [];
    return [
      {
        id: "connect-required",
        kind: "connect_required",
        category: "Setup",
        severity: "critical",
        count: 1,
        target: { tab: "overview" },
      },
    ];
  },
};

export const missingPhotosContributor: LotAttentionContributor = {
  id: "missing-photos",
  appliesTo: (status) => status === "draft",
  evaluate(signals) {
    const lot = signals.lot;
    if (!lot || lot.images.length > 0) return [];
    return [
      {
        id: "missing-photos",
        kind: "missing_photos",
        category: "Catalog",
        severity: "high",
        count: 1,
        target: { tab: "images" },
      },
    ];
  },
};

export const withdrawalPendingContributor: LotAttentionContributor = {
  id: "withdrawal-pending",
  appliesTo: () => true,
  evaluate(signals) {
    if (!signals.withdrawalPending) return [];
    return [
      {
        id: "withdrawal-pending",
        kind: "withdrawal_pending",
        category: "Operations",
        severity: "high",
        count: 1,
        target: { tab: "overview" },
      },
    ];
  },
};

export const DEFAULT_LOT_ATTENTION_CONTRIBUTORS: readonly LotAttentionContributor[] = [
  setupReadinessContributor,
  connectContributor,
  missingPhotosContributor,
  withdrawalPendingContributor,
];
