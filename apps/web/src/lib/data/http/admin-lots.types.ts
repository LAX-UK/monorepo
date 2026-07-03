import type { Lot } from "@auction/types";

export type AdminLotLifecycleSummary = {
  lastEventType: string;
  lastEventAt: string;
  returnCount: number;
};

export type LotDeleteEligibility = {
  canDelete: boolean;
  confirmationPhrase: string | null;
  blockers: string[];
};

export type AdminLotPickerRow = {
  id: string;
  title: string;
  lifecycle: {
    kind: "new_draft" | "returned";
    returnedAt: string | null;
    lastSaleId: string | null;
    lastSaleName: string | null;
    returnCount: number;
  };
};

export type AdminLotLifecyclePayload = {
  snapshot: {
    currentStatus: string;
    lastEventType: string;
    lastEventAt: string;
    lastSaleId: string | null;
    returnCount: number;
  } | null;
  events: {
    eventType: string;
    occurredAt: string;
    saleTitle?: string | null;
  }[];
};

export type LotArtistBackfillReviewTask = {
  id: string;
  kind: string;
  status: string;
  targetLotId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type LotWithdrawalRequestTask = {
  id: string;
  kind: string;
  status: string;
  targetLotId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type AdminLotListRow = Lot & {
  lifecycleSummary?: AdminLotLifecycleSummary;
  connectRequired?: boolean;
  deleteEligibility?: LotDeleteEligibility | null;
};

export class AdminLotBrowseError extends Error {
  readonly status: number;

  constructor(status: number) {
    const hint = status === 404 ? " (browse endpoint missing — restart/rebuild API)" : "";
    super(`Failed to browse lots: ${status}${hint}`);
    this.name = "AdminLotBrowseError";
    this.status = status;
  }
}
