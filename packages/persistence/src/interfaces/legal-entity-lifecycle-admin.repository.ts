import type { Database } from "@auction/db";
import type { LegalEntityStatus, StripeConnectRequirementError } from "@auction/types";

export type LegalEntityLifecycleRow = {
  id: string;
  status: LegalEntityStatus;
  stripeConnectAccountId: string | null;
  stripeConnectChargesEnabled: boolean;
  stripeConnectPayoutsEnabled: boolean;
  stripeConnectRequirementsCurrentlyDue: string[];
  stripeConnectRequirementsErrors: StripeConnectRequirementError[];
  stripeConnectDisabledReason: string | null;
  isLaxManaged: boolean;
  /** When it last stopped being able to pay; `null` if it never could, or can now. */
  payHeldSince: Date | null;
};

export type LegalEntityLifecycleTransitionUpdate = {
  entityId: string;
  actorUserId: string;
  nextStatus: LegalEntityStatus;
  statusReason: string | null;
  /** The organisation's hold on paying after this transition. */
  payHeldSince: Date | null;
};

export interface ILegalEntityLifecycleAdminRepository {
  findById(entityId: string): Promise<LegalEntityLifecycleRow | null>;
  findByIdForUpdate(tx: Database, entityId: string): Promise<LegalEntityLifecycleRow | null>;
  applyTransitionUpdate(tx: Database, input: LegalEntityLifecycleTransitionUpdate): Promise<void>;
}
