import type { Database } from "@auction/db";
import type { LotReofferView, ReofferLockedLot } from "@auction/persistence/interfaces";
import type { WorkerLotLifecycleEventRecorder } from "../lifecycle/worker-lifecycle-event-recorder.js";
import type { IReofferClockEvents, ReofferClockEventType } from "./reoffer-clock-ports.js";

/**
 * Records the clock's steps on the lot's journal, as the API records the people's: ids and
 * amounts only, with the actor named. The lot keeps its ended status through the whole offer.
 */
export class JournalReofferClockEvents implements IReofferClockEvents {
  constructor(private readonly journal: Pick<WorkerLotLifecycleEventRecorder, "record">) {}

  async record(
    tx: Database,
    lot: Pick<ReofferLockedLot, "id" | "saleId" | "sellerLegalEntityId">,
    eventType: ReofferClockEventType,
    offer: LotReofferView,
  ): Promise<void> {
    await this.journal.record(tx, {
      lotId: lot.id,
      eventType,
      payload: {
        reofferId: offer.id,
        buyerDefaultId: offer.buyerDefaultId,
        sequence: offer.sequence,
        actor: "clock",
        amountPence: offer.amountPence,
      },
      actorUserId: null,
      actingLegalEntityId: lot.sellerLegalEntityId ?? null,
      snapshotPatch: { currentStatus: "ended", lastEventType: eventType, lastSaleId: lot.saleId },
    });
  }
}
