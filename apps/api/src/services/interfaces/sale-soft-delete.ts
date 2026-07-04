import type { SaleSoftDeleteGuardCounts } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError } from "../../lib/errors.js";

export type { SaleSoftDeleteGuardCounts } from "@auction/persistence/interfaces";

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

export type { ISaleSoftDeleteSideEffects } from "@auction/persistence/interfaces";

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
