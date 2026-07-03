import type { Database } from "@auction/db";
import type { Lot } from "@auction/types";

/** Narrow port for recording lot cancellation during soft-delete side effects. */
export interface ILotCancelledLifecycleRecorder {
  recordCancelled(
    tx: Database,
    lotRow: Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">,
    reason: "soft_delete" | "sale_soft_delete",
    actorUserId?: string | null,
  ): Promise<void>;
}
