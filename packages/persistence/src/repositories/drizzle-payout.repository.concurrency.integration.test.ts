import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, payout, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzlePayoutRepository } from "./drizzle-payout.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzlePayoutRepository concurrency (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzlePayoutRepository(db);
  const userId = `payout-concurrency-${randomUUID()}`;
  const entityId = randomUUID();
  const payoutIds: string[] = [];

  async function seedPayout(status: string): Promise<string> {
    const [row] = await db
      .insert(payout)
      .values({
        legalEntityId: entityId,
        periodStart: new Date("2026-01-01T00:00:00Z"),
        periodEnd: new Date("2026-01-31T00:00:00Z"),
        grossAmount: "100.00",
        platformFee: "5.00",
        stripeFee: "0.00",
        netAmount: "95.00",
        status,
      })
      .returning({ id: payout.id });
    if (!row) throw new Error("seed_payout_failed");
    payoutIds.push(row.id);
    return row.id;
  }

  beforeAll(async () => {
    const now = new Date();
    await db.insert(user).values({
      id: userId,
      name: "Payout Concurrency",
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(legalEntity).values({
      id: entityId,
      displayName: "Payout Concurrency Entity",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: userId,
      status: "approved",
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    for (const id of payoutIds) await db.delete(payout).where(eq(payout.id, id));
    await db.delete(legalEntity).where(eq(legalEntity.id, entityId));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("applies exactly one of two parallel compare-and-set transitions", async () => {
    const id = await seedPayout("scheduled");
    const patch = { status: "paid" as const, processedAt: new Date(), failureReason: null };

    const results = await Promise.all([
      repo.updateStatusIfCurrent(id, "scheduled", { ...patch, stripeTransferId: `tr_${id}_a` }),
      repo.updateStatusIfCurrent(id, "scheduled", { ...patch, stripeTransferId: `tr_${id}_b` }),
    ]);

    expect(results.filter((r) => r !== null)).toHaveLength(1);
    const stored = await repo.findById(id);
    expect(stored?.status).toBe("paid");
  });

  it("makes the second transaction see the first one's status after the row lock", async () => {
    const id = await seedPayout("scheduled");
    const seen: string[] = [];

    const run = (transferId: string) =>
      db.transaction(async (tx) => {
        const txRepo = new DrizzlePayoutRepository(tx);
        const row = await txRepo.findByIdForUpdate(id);
        if (!row) throw new Error("missing");
        seen.push(row.status);
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (row.status !== "scheduled") return null;
        return txRepo.updateStatusIfCurrent(id, "scheduled", {
          status: "paid",
          stripeTransferId: transferId,
          processedAt: new Date(),
          failureReason: null,
        });
      });

    const results = await Promise.all([run(`tr_${id}_a`), run(`tr_${id}_b`)]);

    expect(results.filter((r) => r !== null)).toHaveLength(1);
    expect(seen.sort()).toEqual(["paid", "scheduled"]);
  });

  it("serialises settlement transactions for one legal entity", async () => {
    const order: string[] = [];
    const run = (label: string) =>
      db.transaction(async (tx) => {
        await new DrizzlePayoutRepository(tx).lockSettlementForEntity(entityId);
        order.push(`${label}:start`);
        await new Promise((resolve) => setTimeout(resolve, 50));
        order.push(`${label}:end`);
      });

    await Promise.all([run("a"), run("b")]);

    const [first, second, third, fourth] = order;
    expect(first?.split(":")[0]).toBe(second?.split(":")[0]);
    expect(third?.split(":")[0]).toBe(fourth?.split(":")[0]);
    expect(second?.endsWith(":end")).toBe(true);
  });
});
