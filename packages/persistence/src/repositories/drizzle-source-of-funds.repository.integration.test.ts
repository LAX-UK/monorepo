import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { sourceOfFunds, user } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleSourceOfFundsRepository } from "./drizzle-source-of-funds.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleSourceOfFundsRepository.create (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleSourceOfFundsRepository(db);
  const userId = `sof-race-${randomUUID()}`;
  const input = {
    userId,
    trigger: "threshold" as const,
    thresholdAmount: "9000.00",
    exposureAmount: "9500.00",
    currency: "GBP",
  };

  beforeAll(async () => {
    const now = new Date();
    await db.insert(user).values({
      id: userId,
      name: userId,
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    await db.delete(sourceOfFunds).where(eq(sourceOfFunds.userId, userId));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("two parallel creates give one pending row, one creator and no error", async () => {
    const [a, b] = await Promise.all([repo.create(input), repo.create(input)]);

    expect(a.case.id).toBe(b.case.id);
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
    const rows = await db
      .select()
      .from(sourceOfFunds)
      .where(and(eq(sourceOfFunds.userId, userId), eq(sourceOfFunds.status, "pending")));
    expect(rows).toHaveLength(1);
  });

  it("returns the existing case without creating on a later call", async () => {
    const again = await repo.create(input);
    expect(again.created).toBe(false);
  });
});
