import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../../../schema/index.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { QUEUE_IDS } from "./queue-ids.js";

const DAY = 86_400_000;
const OPEN_EXPORT_STATUSES = ["requested", "collecting", "delayed", "ready"];

/** The erasure request held for staff to decide. */
export const DEMO_ERASURE_REFERENCE = "DR-DEMO-0001";

/** Compliance: a data export that is running late, and an erasure request waiting on staff. */
export const dataRequestSeeder: QueueSeeder = {
  queue: "Data requests",
  async seed({ db, now, people }: QueueContext) {
    const subjectId = people.heldBuyer;
    const requestedAt = new Date(now - 24 * DAY);
    const dueAt = new Date(now + 6 * DAY);
    const [open] = await db
      .select({ id: schema.subjectDataExport.id })
      .from(schema.subjectDataExport)
      .where(
        and(
          eq(schema.subjectDataExport.subjectId, subjectId),
          inArray(schema.subjectDataExport.status, OPEN_EXPORT_STATUSES),
        ),
      )
      .limit(1);
    // A person has one open export at a time: another one (not this seed's) stands in for it.
    if (!open || open.id === QUEUE_IDS.dataExport(1)) {
      await db
        .insert(schema.subjectDataExport)
        .values({
          id: QUEUE_IDS.dataExport(1),
          subjectId,
          status: "delayed",
          productProgress: { account: "done", bid: "retrying", shop: "done" },
          requestedAt,
          dueAt,
          lastErrorCode: "demo_slow_collection",
        })
        .onConflictDoUpdate({
          target: schema.subjectDataExport.id,
          set: { requestedAt, dueAt, updatedAt: new Date(now) },
        });
    }

    await db
      .insert(schema.dataRequestErasureHold)
      .values({
        reference: DEMO_ERASURE_REFERENCE,
        requestedByUserId: people.collector,
        state: "needs_staff",
        reason: "cannot_run",
        createdAt: new Date(now - 4 * DAY),
        updatedAt: new Date(now - 4 * DAY),
      })
      .onConflictDoNothing();
  },
};
