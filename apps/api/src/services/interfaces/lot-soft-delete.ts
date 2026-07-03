import type { Lot } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError } from "../../lib/errors.js";

export type { LotSoftDeleteGuardCounts } from "@auction/persistence";

export type LotDeleteEligibility = {
  canDelete: boolean;
  confirmationPhrase: string | null;
  blockers: string[];
};

export type LotBulkSoftDeleteError = {
  lotId: string;
  message: string;
  blockers?: string[];
};

export type LotBulkSoftDeleteResult = {
  attempted: number;
  failed: number;
  errors: LotBulkSoftDeleteError[];
  orphanDraftSales: Array<{ id: string; title: string }>;
};

export interface ILotSoftDeleteSideEffects {
  softDeleteLot(input: {
    lotId: string;
    actorUserId: string;
    deletedAt: Date;
  }): Promise<void>;
}

export interface ILotSoftDeleteService {
  getDeleteEligibility(lotId: string): Promise<LotDeleteEligibility | null>;
  getDeleteEligibilityBatch(lots: Lot[]): Promise<Map<string, LotDeleteEligibility>>;
  softDelete(
    actorUserId: string,
    userRole: string,
    lotId: string,
    confirmationPhrase: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, LotError | AuthzError>>;
  bulkSoftDelete(
    actorUserId: string,
    userRole: string,
    ids: string[],
    confirmationPhrase: string,
    userStaffRole?: string | null,
  ): Promise<Result<LotBulkSoftDeleteResult, AuthzError | LotError>>;
}
