import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, payout, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzlePayoutRepository } from "./drizzle-payout.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("payout reversal line (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzlePayoutRepository(db);
  const userId = `payout-reversal-${randomUUID()}`;
  const entityId = randomUUID();
  const payoutId = randomUUID();

  beforeAll(async () => {
    const now = new Date();
    await db.insert(user).values({
      id: userId,
      name: "Payout Reversal",
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(legalEntity).values({
      id: entityId,
      displayName: "Payout Reversal Entity",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: userId,
      status: "approved",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(payout).values({
      id: payoutId,
      legalEntityId: entityId,
      periodStart: new Date("2026-01-01T00:00:00Z"),
      periodEnd: new Date("2026-01-31T00:00:00Z"),
      grossAmount: "100.00",
      platformFee: "5.00",
      stripeFee: "0.00",
      netAmount: "95.00",
      status: "paid",
    });
  });

  afterAll(async () => {
    await db.delete(payout).where(eq(payout.id, payoutId));
    await db.delete(legalEntity).where(eq(legalEntity.id, entityId));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("stores a reversal line that names no single payment", async () => {
    const line = await repo.insertLine({
      payoutId,
      paymentId: null,
      amount: "-95.00",
      kind: "reversal",
      createdByUserId: userId,
      note: "Admin reversal: bank returned the transfer",
      sourceEventId: `admin_reverse:${payoutId}`,
    });

    expect(line.kind).toBe("reversal");
    expect(line.paymentId).toBeNull();
    const stored = await repo.listLines(payoutId);
    expect(stored.map((l) => [l.kind, l.amount])).toEqual([["reversal", "-95.00"]]);
  });

  it("still requires a payment on a sale line", async () => {
    await expect(
      repo.insertLine({
        payoutId,
        paymentId: null,
        amount: "10.00",
        kind: "sale",
        createdByUserId: null,
        note: null,
      }),
    ).rejects.toThrow();
  });
});
