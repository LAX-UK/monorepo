import * as schema from "../../../schema/index.js";
import { DEMO_PEOPLE } from "../demo-topup-ids.js";
import { personalEntityOf } from "../demo-topup-seed.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { QUEUE_IDS } from "./queue-ids.js";

const DAY = 86_400_000;

/** Cataloguing: a consignment a seller has sent in and nobody has looked at yet. */
export const consignmentSeeder: QueueSeeder = {
  queue: "Consignments awaiting review",
  async seed({ db, now, people }: QueueContext) {
    await db
      .insert(schema.itemSubmission)
      .values({
        id: QUEUE_IDS.submission(1),
        legalEntityId: personalEntityOf(DEMO_PEOPLE.collector),
        title: "Harbour at Dusk, oil on board (demo)",
        description: "A small harbour scene. Invented for the demo.",
        medium: "Oil on board",
        dimensions: "30 x 40 cm",
        yearOfWork: "1962",
        askingPrice: "3500.00",
        status: "submitted",
        submittedByUserId: people.collector,
        createdAt: new Date(now - 2 * DAY),
        updatedAt: new Date(now - 2 * DAY),
      })
      .onConflictDoNothing();
  },
};
