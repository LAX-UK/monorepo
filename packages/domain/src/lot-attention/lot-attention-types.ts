export type LotAttentionSeverity = "critical" | "high" | "medium" | "low";

export const LOT_ATTENTION_SEVERITY_RANK: Record<LotAttentionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type LotAttentionKind =
  | "setup_readiness"
  | "connect_required"
  | "missing_photos"
  | "withdrawal_pending";

export type LotAttentionTarget = {
  tab?: "overview" | "images" | "documents" | "bids";
  external?: string;
};

export type LotAttentionItem = {
  id: string;
  kind: LotAttentionKind;
  category: string;
  severity: LotAttentionSeverity;
  count: number;
  target?: LotAttentionTarget;
};

export type LotAttentionSignals = {
  notFound?: boolean;
  lot?: {
    id: string;
    status: string;
    title: string;
    images: readonly string[];
    description?: string | null;
    sellerLegalEntityId?: string | null;
  } | null;
  connectRequired?: boolean;
  withdrawalPending?: boolean;
  publishReadinessPercent?: number | null;
};

export type LotAttentionResult = {
  items: LotAttentionItem[];
  totalCount: number;
  truncated: boolean;
};

export type LotAttentionPrincipal = {
  role: "client" | "staff" | "seller";
  staffRole: string | null;
};
