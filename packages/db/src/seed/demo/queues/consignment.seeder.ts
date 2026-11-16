import { evaluateSubmissionQuality } from "@auction/domain";
import * as schema from "../../../schema/index.js";
import { ART } from "../demo-topup-catalogue.js";
import { DEMO_PEOPLE } from "../demo-topup-ids.js";
import { personalEntityOf } from "../demo-topup-seed.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { QUEUE_IDS } from "./queue-ids.js";

const DAY = 86_400_000;

/** The work Charlotte Hayes sends in: everything the submit step asks for (title, category, a picture). */
export const DEMO_CONSIGNMENT = {
  title: "Harbour at Dusk, oil on board (demo)",
  description: "A small harbour scene. Invented for the demo.",
  categorySlug: "paintings",
  images: [ART[2]],
} as const;

/**
 * Submissions (`/admin/submissions`, awaiting review) and the work inbox: a consignment a seller
 * has sent in and nobody has looked at yet. Written once, complete enough to pass the same
 * quality check the seller's submit step applies.
 */
export const consignmentSeeder: QueueSeeder = {
  queue: "Consignments awaiting review",
  async seed({ db, now, people, categoryIdBySlug }: QueueContext) {
    const categoryId = categoryIdBySlug.get(DEMO_CONSIGNMENT.categorySlug);
    if (!categoryId) throw new Error("[demo-queues] needs the paintings category");
    const quality = evaluateSubmissionQuality({
      title: DEMO_CONSIGNMENT.title,
      description: DEMO_CONSIGNMENT.description,
      provenance: [],
      categoryId,
      categoryIds: [categoryId],
      images: [...DEMO_CONSIGNMENT.images],
    });
    if (!quality.canSubmit)
      throw new Error("[demo-queues] the demo consignment could not be submitted");
    const id = QUEUE_IDS.submission(1);
    const sentAt = new Date(now - 2 * DAY);
    const [created] = await db
      .insert(schema.itemSubmission)
      .values({
        id,
        legalEntityId: personalEntityOf(DEMO_PEOPLE.collector),
        title: DEMO_CONSIGNMENT.title,
        description: DEMO_CONSIGNMENT.description,
        medium: "Oil on board",
        dimensions: "30 x 40 cm",
        yearOfWork: "1962",
        images: [...DEMO_CONSIGNMENT.images],
        askingPrice: "3500.00",
        status: "submitted",
        submittedByUserId: people.collector,
        createdAt: sentAt,
        updatedAt: sentAt,
      })
      .onConflictDoNothing()
      .returning({ id: schema.itemSubmission.id });
    if (!created) return;
    await db
      .insert(schema.submissionCategories)
      .values({ submissionId: id, categoryId, sortOrder: 0 });
  },
};
