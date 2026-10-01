import { createDbFromPool } from "@auction/db";
import { emailOutbox } from "@auction/db/schema";
import type { IEmailSender } from "@auction/email";
import { eq } from "drizzle-orm";
import pg from "pg";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IEmailOutboxRepository } from "../interfaces/email-outbox.repository.js";
import { sendEmailUseCase } from "../services/send-email.use-case.js";
import { DrizzleEmailOutboxRepository } from "./drizzle-email-outbox.repository.js";

const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("DrizzleEmailOutboxRepository claimForSend", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: databaseUrl });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("allows only one pending-to-sending claim for the same row", async () => {
    const db = createDbFromPool(pool);
    const idempotencyKey = `claim-test:${Date.now()}:${Math.random()}`;
    const [inserted] = await db
      .insert(emailOutbox)
      .values({
        idempotencyKey,
        toEmailHash: "abc123",
        toSnapshot: "claim-test@example.com",
        toSnapshotPurgeAt: new Date(Date.now() + 86_400_000),
        template: "shop-checkout-ops-alert",
        vars: { alertKind: "test", orderId: "order", detail: "detail" },
        status: "pending",
        stream: "transactional",
        category: "transactional",
        flaggedAddress: false,
      })
      .returning({ id: emailOutbox.id });
    const outboxId = inserted?.id;
    expect(outboxId).toBeDefined();
    if (!outboxId) return;

    const repo = new DrizzleEmailOutboxRepository(db);
    const [first, second] = await Promise.all([
      repo.claimForSend(outboxId),
      repo.claimForSend(outboxId),
    ]);

    const winners = [first, second].filter((c) => c?.claimed === true);
    expect(winners).toHaveLength(1);
    expect([first, second].every((c) => c?.row.status === "sending")).toBe(true);

    const [row] = await db
      .select({ status: emailOutbox.status, attempts: emailOutbox.attempts })
      .from(emailOutbox)
      .where(eq(emailOutbox.id, outboxId));
    expect(row?.status).toBe("sending");
    expect(row?.attempts).toBe(1);
  });

  it("runs sendEmailUseCase at most once under concurrent claims", async () => {
    const db = createDbFromPool(pool);
    const idempotencyKey = `claim-send-test:${Date.now()}:${Math.random()}`;
    const [inserted] = await db
      .insert(emailOutbox)
      .values({
        idempotencyKey,
        toEmailHash: "def456",
        toSnapshot: "claim-send@example.com",
        toSnapshotPurgeAt: new Date(Date.now() + 86_400_000),
        template: "shop-checkout-ops-alert",
        vars: { alertKind: "test", orderId: "order", detail: "detail" },
        status: "pending",
        stream: "transactional",
        category: "transactional",
        flaggedAddress: false,
      })
      .returning({ id: emailOutbox.id });
    const outboxId = inserted?.id;
    if (!outboxId) throw new Error("missing outbox id");

    const repo: IEmailOutboxRepository = new DrizzleEmailOutboxRepository(db);
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const sender: IEmailSender = { send };
    const log = pino({ level: "silent" });
    const deps = { outboxRepo: repo, sender, log };

    await Promise.all([sendEmailUseCase(deps, { outboxId }), sendEmailUseCase(deps, { outboxId })]);

    expect(send).toHaveBeenCalledTimes(1);
  });
});
