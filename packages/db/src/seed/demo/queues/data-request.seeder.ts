import { subjectExportDueAt } from "@auction/identity-contracts";
import * as schema from "../../../schema/index.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { QUEUE_IDS } from "./queue-ids.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The deadline alerts the export has already raised, by tier, as the maintenance job records them. */
const ALERTS = [
  { tier: 1, audience: "operations", afterMs: DAY },
  { tier: 2, audience: "data_protection_contact", afterMs: 7 * DAY },
  { tier: 3, audience: "on_call", afterMs: 21 * DAY },
] as const;

/**
 * Data requests (`/admin/compliance/data-requests`, Open): a "Download my data" request that is
 * running late because the Bid part keeps failing, with its history (requested, delayed, and the
 * three deadline alerts it raised on the way). Written once and never changed.
 *
 * It already carries the last alert tier, so the deadline job raises nothing for it on test; and it
 * is not put on the export queue, so no worker picks it up and finishes it.
 */
export const dataRequestSeeder: QueueSeeder = {
  queue: "Data requests",
  async seed({ db, now, people }: QueueContext) {
    const subjectId = people.heldBuyer;
    const requestedAt = new Date(now - 24 * DAY);
    const dueAt = subjectExportDueAt(requestedAt);
    const exportId = QUEUE_IDS.dataExport(1);
    const [created] = await db
      .insert(schema.subjectDataExport)
      .values({
        id: exportId,
        subjectId,
        status: "delayed",
        productProgress: { account: "done", bid: "retrying", shop: "done" },
        requestedAt,
        dueAt,
        lastErrorCode: "demo_slow_collection",
        deadlineAlertTier: 3,
        createdAt: requestedAt,
        updatedAt: new Date(requestedAt.getTime() + 21 * DAY),
      })
      // A person has one open export at a time: if they already have one, it stands in for this.
      .onConflictDoNothing()
      .returning({ id: schema.subjectDataExport.id });
    if (!created) return;

    await db.insert(schema.subjectDataExportAudit).values([
      {
        exportId,
        subjectId,
        event: "data_export.requested",
        detail: { dueAt: dueAt.toISOString() },
        occurredAt: requestedAt,
      },
      {
        exportId,
        subjectId,
        event: "data_export.delayed",
        detail: { product: "bid", errorCode: "demo_slow_collection" },
        occurredAt: new Date(requestedAt.getTime() + 2 * HOUR),
      },
      ...ALERTS.map((alert) => ({
        exportId,
        subjectId,
        event: "data_export.deadline_alert",
        detail: { tier: alert.tier, audience: alert.audience },
        occurredAt: new Date(requestedAt.getTime() + alert.afterMs),
      })),
    ]);
  },
};
