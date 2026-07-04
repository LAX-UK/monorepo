import type { Lot } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError } from "../../lib/errors.js";

export type { LotSoftDeleteGuardCounts } from "@auction/persistence/interfaces";

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

export type { ILotSoftDeleteSideEffects } from "@auction/persistence/interfaces";

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
