import type { Database } from "@auction/db";
import type { LegalEntityStatus } from "@auction/types";

export type LegalEntityLifecycleRow = {
  id: string;
  status: LegalEntityStatus;
};

export type LegalEntityLifecycleTransitionUpdate = {
  entityId: string;
  actorUserId: string;
  nextStatus: LegalEntityStatus;
  statusReason: string | null;
};

export interface ILegalEntityLifecycleAdminRepository {
  findById(entityId: string): Promise<LegalEntityLifecycleRow | null>;
  findByIdForUpdate(tx: Database, entityId: string): Promise<LegalEntityLifecycleRow | null>;
  applyTransitionUpdate(tx: Database, input: LegalEntityLifecycleTransitionUpdate): Promise<void>;
}
