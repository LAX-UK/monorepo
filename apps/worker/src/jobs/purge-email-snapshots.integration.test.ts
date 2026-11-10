import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { emailOutbox } from "@auction/db/schema";
import { emailHash } from "@auction/email";
import { DrizzleTransactionRunner } from "@auction/persistence/repositories";
import { eq, inArray } from "drizzle-orm";
import pino from "pino";
import { afterAll, describe, expect, it } from "vitest";
import { purgeEmailSnapshots } from "./purge-email-snapshots.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * The daily snapshot purge, run as `worker_app` against real rows: a finished row past its
 * deadline loses its address and variables whatever it ended as, and a row that is queued, being
 * sent or not yet due is left alone. Skipped where the role is not set up.
 */
describe.skipIf(!ownerUrl || !workerUrl)(
  "purging email snapshots as worker_app (integration)",
  () => {
    const run = randomUUID().slice(0, 8);
    const address = `purge-${run}@example.com`;
    // biome-ignore lint/style/noNonNullAssertion: gated above
    const owner = createDb(ownerUrl!);
    // biome-ignore lint/style/noNonNullAssertion: gated above
    const worker = createDb(workerUrl!);
    const runner = new DrizzleTransactionRunner(worker as never);
    const ids: string[] = [];
    const long = new Date("2020-01-01T00:00:00Z");
    const soon = new Date(Date.now() + 86_400_000);

    async function queued(status: string, purgeAt: Date | null): Promise<string> {
      const [row] = await owner
        .insert(emailOutbox)
        .values({
          idempotencyKey: `purge-test:${run}:${randomUUID()}`,
          toEmailHash: emailHash(address),
          toSnapshot: address,
          toSnapshotPurgeAt: purgeAt,
          template: "collection-collector-notice",
          vars: { calendar: { content: `mailto:${address}` }, collectorName: "Sam" },
          category: "transactional",
          status: status as never,
        })
        .returning({ id: emailOutbox.id });
      const id = (row as { id: string }).id;
      ids.push(id);
      return id;
    }

    async function read(id: string) {
      const [row] = await owner.select().from(emailOutbox).where(eq(emailOutbox.id, id));
      return row as typeof emailOutbox.$inferSelect;
    }

    afterAll(async () => {
      if (ids.length > 0) await owner.delete(emailOutbox).where(inArray(emailOutbox.id, ids));
    });

    it("clears the address and variables of finished mail past its deadline, and nothing else about the row", async () => {
      const finished = await Promise.all(
        ["sent", "failed", "suppressed"].map((status) => queued(status, long)),
      );
      const result = await purgeEmailSnapshots({
        transactionRunner: runner,
        log: pino({ level: "silent" }),
      });
      expect(result.cleared).toBeGreaterThanOrEqual(3);
      for (const id of finished) {
        const after = await read(id);
        expect(after.toSnapshot).toBeNull();
        expect(after.toSnapshotPurgeAt).toBeNull();
        expect(after.vars).toEqual({});
        expect(after.toEmailHash).toBe(emailHash(address));
        expect(after.idempotencyKey).toContain("purge-test:");
      }
      expect((await read(finished[0] as string)).status).toBe("sent");
      expect((await read(finished[1] as string)).status).toBe("failed");
    });

    it("leaves queued and in-flight mail, and mail not yet due", async () => {
      const pending = await queued("pending", long);
      const sending = await queued("sending", long);
      const notYet = await queued("sent", soon);
      await purgeEmailSnapshots({ transactionRunner: runner, log: pino({ level: "silent" }) });
      for (const id of [pending, sending, notYet]) {
        const after = await read(id);
        expect(after.toSnapshot).toBe(address);
        expect(after.vars).not.toEqual({});
      }
    });

    it("clears mail that was in flight once its send is over, and changes nothing when run again", async () => {
      const sending = await queued("sending", long);
      await owner.update(emailOutbox).set({ status: "sent" }).where(eq(emailOutbox.id, sending));
      const first = await purgeEmailSnapshots({
        transactionRunner: runner,
        log: pino({ level: "silent" }),
      });
      expect(first.cleared).toBeGreaterThanOrEqual(1);
      expect((await read(sending)).toSnapshot).toBeNull();
      const again = await purgeEmailSnapshots({
        transactionRunner: runner,
        log: pino({ level: "silent" }),
      });
      expect(again.cleared).toBe(0);
    });
  },
);
