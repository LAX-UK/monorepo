import { deliveryRepoForProjectorTransaction } from "../../container/delivery-repo-for-projector-transaction.js";
import type { ProjectorDbConnection } from "../../interfaces/worker-db.types.js";
import type { ProjectorRunContext } from "./projector.types.js";

const BATCH_LIMIT = 100;

/**
 * Moves one consumer's cursor over the next events of the given types and queues a delivery for
 * each, in one transaction, so an event is queued exactly once however often this runs.
 */
export async function queueConsumerDeliveries(
  ctx: ProjectorRunContext,
  consumer: string,
  eventTypes: readonly string[],
): Promise<void> {
  if (!ctx.deliveryRepo) throw new Error(`${consumer}_missing_delivery_repo`);
  const deliveryRepo = ctx.deliveryRepo;
  await ctx.transactionRunner.runInTransaction(async (tx) => {
    const txDeliveryRepo = deliveryRepoForProjectorTransaction(tx, deliveryRepo);
    const events = await ctx.domainEventReader.listLockedForProjector(
      consumer,
      BATCH_LIMIT,
      tx as ProjectorDbConnection,
      { eventTypes },
    );
    for (const event of events) {
      await txDeliveryRepo.ensurePending({
        consumer,
        eventId: event.id,
        idempotencyKey: `${consumer}:${event.id}`,
      });
    }
    const maxId = Math.max(0, ...events.map((event) => event.id));
    if (maxId > 0) {
      await ctx.projectorStateRepo.advanceCursorLiteralName(consumer, maxId, tx);
    }
  });
}
