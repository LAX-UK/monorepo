import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, lot, user, watchlist } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleWatchlistReminderRepository } from "./drizzle-watchlist-reminder.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const HOUR = 60 * 60 * 1000;

describe.skipIf(!HAS_DB)("DrizzleWatchlistReminderRepository (integration)", () => {
  it("sets reminders only on watched lots, finds the due ones once, and clears them", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const userId = `reminder-user-${tag}`;
    const sellerId = randomUUID();
    const [soon, later, closed, unwatched] = [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ];

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: userId,
          name: "Wendy Watcher",
          email: `${userId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(legalEntity).values({
          id: sellerId,
          displayName: "Seller",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: userId,
          status: "approved",
          createdAt: now,
          updatedAt: now,
        });
        const newLot = (id: string, endsIn: number, status: "active" | "ended" = "active") => ({
          id,
          title: `Lot ${id.slice(0, 4)}`,
          auctionType: "english" as const,
          startingPrice: "100.00",
          currentPrice: "100.00",
          minBidIncrement: "10.00",
          sellerLegalEntityId: sellerId,
          startTime: new Date(now.getTime() - 24 * HOUR),
          endTime: new Date(now.getTime() + endsIn),
          status,
          createdAt: now,
          updatedAt: now,
        });
        await tx
          .insert(lot)
          .values([
            newLot(soon, 30 * 60 * 1000),
            newLot(later, 5 * HOUR),
            newLot(closed, -HOUR, "ended"),
            newLot(unwatched, HOUR),
          ]);
        await tx
          .insert(watchlist)
          .values([soon, later, closed].map((lotId) => ({ userId, lotId })));

        const reminders = new DrizzleWatchlistReminderRepository(tx as never);
        expect(
          await reminders.set(userId, unwatched, { kind: "sale_start", note: null }),
        ).toBeNull();
        for (const lotId of [soon, later, closed]) {
          await reminders.set(userId, lotId, {
            kind: "hour_before_close",
            note: "Check the frame",
          });
        }
        expect((await reminders.listForUser(userId)).map((r) => r.lotId).sort()).toEqual(
          [soon, later, closed].sort(),
        );

        const pending = await reminders.listPending(now, 50);
        const mine = pending.filter((r) => r.userId === userId);
        // The one an hour from closing, and the closed one (to be dropped); not the later one.
        expect(mine.map((r) => r.lotId).sort()).toEqual([soon, closed].sort());
        expect(mine.find((r) => r.lotId === closed)?.closed).toBe(true);
        expect(mine.find((r) => r.lotId === soon)).toMatchObject({ note: "Check the frame" });

        const first = mine.find((r) => r.lotId === soon);
        if (!first) throw new Error("missing");
        expect(await reminders.markSent(first.watchlistId, now)).toBe(true);
        expect(await reminders.markSent(first.watchlistId, now)).toBe(false);

        // Changing a reminder sends it again.
        await reminders.set(userId, soon, { kind: "hour_before_close", note: null });
        expect((await reminders.listForUser(userId)).find((r) => r.lotId === soon)?.sentAt).toBe(
          null,
        );

        await reminders.clear(userId, later);
        expect((await reminders.listForUser(userId)).some((r) => r.lotId === later)).toBe(false);

        // Unwatching removes the reminder with it.
        await tx.delete(watchlist).where(eq(watchlist.lotId, soon));
        expect((await reminders.listForUser(userId)).some((r) => r.lotId === soon)).toBe(false);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
