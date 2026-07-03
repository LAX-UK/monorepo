import type { Lot, Sale } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError } from "../../lib/errors.js";

export type SaleSoftDeleteGuardCounts = {
  bidCount: number;
  paymentCount: number;
  approvedRegistrationCount: number;
};

export type SaleDeleteEligibility = {
  canDelete: boolean;
  confirmationPhrase: string | null;
  guards: SaleSoftDeleteGuardCounts;
  blockers: string[];
};

export type SaleBulkSoftDeleteError = {
  saleId: string;
  message: string;
  blockers?: string[];
};

export type SaleBulkSoftDeleteResult = {
  attempted: number;
  failed: number;
  errors: SaleBulkSoftDeleteError[];
};

export interface ISaleSoftDeleteSideEffects {
  softDeleteCascade(input: {
    saleId: string;
    actorUserId: string;
    deletedAt: Date;
    lotIds: string[];
  }): Promise<void>;
}

export interface ISaleSoftDeleteService {
  getDeleteEligibility(saleId: string): Promise<SaleDeleteEligibility | null>;
  getDeleteEligibilityBatch(
    rows: Array<{ sale: Sale; lots: Lot[] }>,
  ): Promise<Map<string, SaleDeleteEligibility>>;
  softDelete(
    actorUserId: string,
    userRole: string,
    saleId: string,
    confirmationPhrase: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, LotError | AuthzError>>;
  bulkSoftDelete(
    actorUserId: string,
    userRole: string,
    ids: string[],
    confirmationPhrase: string,
    userStaffRole?: string | null,
  ): Promise<Result<SaleBulkSoftDeleteResult, AuthzError | LotError>>;
}
