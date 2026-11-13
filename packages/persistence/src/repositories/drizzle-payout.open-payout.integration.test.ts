import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, payout, user } from "@auction/db/schema";
import { TRANSFER_OUTCOME_UNKNOWN_PREFIX, TRANSFER_REFUSED_PREFIX } from "@auction/domain";
import type { PayoutStatus } from "@auction/types";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzlePayoutRepository } from "./drizzle-payout.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/** Which payout a refund, give-back or dispute line goes on: `findOpenPayoutForEntity`. */
describe.skipIf(!HAS_DB)("DrizzlePayoutRepository open payout (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzlePayoutRepository(db);
  const userId = `payout-open-${randomUUID()}`;
  const entityIds: string[] = [];
  let day = 1;

  beforeAll(async () => {
    const now = new Date();
    await db.insert(user).values({
      id: userId,
      name: "Payout Open",
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    if (entityIds.length > 0) {
      await db.delete(payout).where(inArray(payout.legalEntityId, entityIds));
      await db.delete(legalEntity).where(inArray(legalEntity.id, entityIds));
    }
    await db.delete(user).where(eq(user.id, userId));
  });

  async function seller(): Promise<string> {
    const id = randomUUID();
    const now = new Date();
    await db.insert(legalEntity).values({
      id,
      displayName: "Payout Open Entity",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: userId,
      status: "approved",
      createdAt: now,
      updatedAt: now,
    });
    entityIds.push(id);
    return id;
  }

  /** A payout for the seller, each one later than the last. */
  async function seedPayout(
    legalEntityId: string,
    status: PayoutStatus,
    failureReason: string | null = null,
  ): Promise<string> {
    const periodEnd = new Date(Date.UTC(2026, 0, day++));
    const [row] = await db
      .insert(payout)
      .values({
        legalEntityId,
        periodStart: new Date(periodEnd.getTime() - 86_400_000),
        periodEnd,
        grossAmount: "100.00",
        platformFee: "5.00",
        stripeFee: "0.00",
        netAmount: "95.00",
        status,
        failureReason,
      })
      .returning({ id: payout.id });
    if (!row) throw new Error("seed_payout_failed");
    return row.id;
  }

  it("never returns a payout whose transfer has started, even the latest", async () => {
    const entity = await seller();
    const scheduled = await seedPayout(entity, "scheduled");
    await seedPayout(entity, "in_transit");

    expect((await repo.findOpenPayoutForEntity(entity))?.id).toBe(scheduled);
  });

  it("finds nothing open when the only payout is in transit", async () => {
    const entity = await seller();
    await seedPayout(entity, "in_transit");

    expect(await repo.findOpenPayoutForEntity(entity)).toBeNull();
  });

  it("finds nothing open when the scheduled payout's last attempt has an unknown outcome", async () => {
    const entity = await seller();
    await seedPayout(entity, "scheduled", `${TRANSFER_OUTCOME_UNKNOWN_PREFIX} unknown - timeout`);

    expect(await repo.findOpenPayoutForEntity(entity)).toBeNull();
  });

  it("still finds a scheduled payout whose last attempt Stripe refused", async () => {
    const entity = await seller();
    const refused = await seedPayout(
      entity,
      "scheduled",
      `${TRANSFER_REFUSED_PREFIX} balance_insufficient - Insufficient funds`,
    );

    expect((await repo.findOpenPayoutForEntity(entity))?.id).toBe(refused);
  });
});
