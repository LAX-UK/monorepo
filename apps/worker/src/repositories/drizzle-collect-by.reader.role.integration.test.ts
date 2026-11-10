import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { DrizzleCollectionLotFactsReader } from "@auction/persistence/repositories";
import { describe, expect, it } from "vitest";
import { DrizzleCollectByReader } from "./drizzle-collect-by.reader.js";
import { DrizzleCollectionNoticeReader } from "./drizzle-collection-notice.reader.js";

const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * Runs what the storage reminder sweep reads as `worker_app`, the role the worker connects with.
 * A table the role may not read makes every reminder group fail with "permission denied", which the
 * sweep logs and carries on from, so no reminder is ever sent; this fails instead.
 */
describe.skipIf(!workerUrl)("storage reminder reads as worker_app", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by workerUrl
  const db = createDb(workerUrl!);

  it("reads the lots waiting at a collection place", async () => {
    const reader = new DrizzleCollectByReader(db);
    await expect(
      reader.storedLotsDue({
        today: "2031-03-10",
        defaultFreeStorageDays: 30,
        reminderLeadDays: 7,
      }),
    ).resolves.toBeInstanceOf(Array);
    await expect(reader.queuedKeys([`role-probe-${randomUUID()}`])).resolves.toEqual(new Set());
  });

  it("reads each lot's eligibility to collect: payments, quotes, disputes, refunds, checks", async () => {
    const facts = new DrizzleCollectionLotFactsReader(db);
    // An id that is no lot: the queries still run, and the role is checked as they are planned.
    await expect(facts.read([randomUUID()])).resolves.toBeInstanceOf(Map);
  });

  it("reads who to email for an account", async () => {
    const notices = new DrizzleCollectionNoticeReader(db);
    await expect(notices.accountRecipients(randomUUID(), [randomUUID()])).resolves.toEqual([]);
  });
});
