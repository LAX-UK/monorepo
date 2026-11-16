import { assertDemoSeedDatabase } from "../../shared/demo-seed-target.js";
import { collectionSeeder } from "./collection.seeder.js";
import { consignmentSeeder } from "./consignment.seeder.js";
import { dataRequestSeeder } from "./data-request.seeder.js";
import { disputeSeeder } from "./dispute.seeder.js";
import { privateSaleSeeder } from "./private-sale.seeder.js";
import { purchaseProblemSeeder } from "./purchase-problem.seeder.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { unappliedMoneySeeder } from "./unapplied-money.seeder.js";

export type { QueueContext, QueueSeeder } from "./queue-context.js";

/** Every staff queue the demo fills, in the order they run. */
export const QUEUE_SEEDERS: readonly QueueSeeder[] = [
  purchaseProblemSeeder,
  unappliedMoneySeeder,
  disputeSeeder,
  dataRequestSeeder,
  collectionSeeder,
  consignmentSeeder,
  privateSaleSeeder,
];

/**
 * Runs each seeder in turn and returns the queues it filled. It refuses, before writing anything,
 * a database that does not carry the demo seed mark, so it is safe to call on its own.
 */
export async function seedStaffQueues(
  context: QueueContext,
  seeders: readonly QueueSeeder[] = QUEUE_SEEDERS,
): Promise<string[]> {
  await assertDemoSeedDatabase(context.db, "demo-queues");
  const filled: string[] = [];
  for (const seeder of seeders) {
    await seeder.seed(context);
    filled.push(seeder.queue);
  }
  return filled;
}
