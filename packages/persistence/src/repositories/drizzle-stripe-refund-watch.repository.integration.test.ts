import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { stripeRefundWatch } from "@auction/db/schema";
import { like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleStripeRefundWatchRepository } from "./drizzle-stripe-refund-watch.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("stripe refund watch (integration)", () => {
  const run = randomUUID().slice(0, 8);
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleStripeRefundWatchRepository(db);
  const id = (n: number) => `re_watch_${run}_${n}`;
  const sighting = (n: number, status = "pending") => ({
    stripeRefundId: id(n),
    stripeChargeId: `ch_watch_${run}`,
    status,
    amountPence: 1_000 * n,
    paymentId: null,
  });
  // Far ahead of any other test's rows, so only this run's rows are due.
  const later = (minutes: number) => new Date(Date.now() + 365 * 86_400_000 + minutes * 60_000);

  afterAll(async () => {
    await db
      .delete(stripeRefundWatch)
      .where(like(stripeRefundWatch.stripeRefundId, `re_watch_${run}_%`));
  });

  it("watches only refunds that are not final, once each, keeping a staff context added later", async () => {
    await repo.watch([sighting(1), sighting(2, "requires_action"), sighting(3, "succeeded")]);
    await repo.watch([{ ...sighting(1), staffRefund: { adminUserId: "admin-1" } }]);
    const due = (await repo.claimDue(50, 60_000, later(0))).filter((r) =>
      r.stripeRefundId.startsWith(`re_watch_${run}_`),
    );
    expect(due.map((r) => [r.stripeRefundId, r.status, r.amountPence])).toEqual([
      [id(1), "pending", 1_000],
      [id(2), "requires_action", 2_000],
    ]);
    expect(due.find((r) => r.stripeRefundId === id(1))?.staffRefund).toEqual({
      adminUserId: "admin-1",
    });
  });

  it("leases what it takes, backs off on reschedule and never returns a settled refund", async () => {
    const at = later(10);
    // Leased by the claim above until a minute after it: an overlapping run takes nothing.
    expect(
      (await repo.claimDue(50, 60_000, at)).filter((r) =>
        r.stripeRefundId.startsWith(`re_watch_${run}_`),
      ),
    ).toHaveLength(2);
    expect(
      (await repo.claimDue(50, 60_000, at)).filter((r) =>
        r.stripeRefundId.startsWith(`re_watch_${run}_`),
      ),
    ).toEqual([]);

    await repo.reschedule(id(1), { status: "pending", nextCheckAt: later(30), lastError: "boom" });
    await repo.markSettled(id(2), "succeeded", later(11));
    const next = (await repo.claimDue(50, 60_000, later(31))).filter((r) =>
      r.stripeRefundId.startsWith(`re_watch_${run}_`),
    );
    expect(next.map((r) => [r.stripeRefundId, r.attempts])).toEqual([[id(1), 1]]);
    // A settled refund seen again by a webhook is not watched a second time.
    await repo.watch([sighting(2)]);
    expect(
      (await repo.claimDue(50, 60_000, later(500))).map((r) => r.stripeRefundId),
    ).not.toContain(id(2));
  });

  it("takes at most the batch asked for", async () => {
    await repo.watch([sighting(4), sighting(5), sighting(6)]);
    const taken = await repo.claimDue(2, 60_000, later(2_000));
    expect(taken.length).toBeLessThanOrEqual(2);
  });
});
