import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, legalEntityMember, lot, notification, user } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MuteAwareNotificationWriter } from "../lib/mute-aware-notification-writer.js";
import { DrizzleNotificationAccountMuteRepository } from "./drizzle-notification-account-mute.repository.js";
import { DrizzleNotificationReadRepository } from "./drizzle-notification-read.repository.js";
import { DrizzleNotificationWriteRepository } from "./drizzle-notification-write.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("notification inbox by account (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzleNotificationReadRepository(db);
  const mutes = new DrizzleNotificationAccountMuteRepository(db);
  const writer = new MuteAwareNotificationWriter(new DrizzleNotificationWriteRepository(db), mutes);
  const userId = `inbox-${randomUUID()}`;
  const personalId = randomUUID();
  const northId = randomUUID();
  const formerId = randomUUID();
  const openLotId = randomUUID();
  const closedLotId = randomUUID();
  const now = new Date();

  beforeAll(async () => {
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(legalEntity).values([
      {
        id: personalId,
        displayName: "Ada Lovelace",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: userId,
        status: "approved",
      },
      {
        id: northId,
        displayName: "Northbank Gallery",
        kind: "organisation",
        subkind: "gallery",
        createdByUserId: userId,
        status: "approved",
      },
      {
        id: formerId,
        displayName: "Harrington Advisors",
        kind: "organisation",
        subkind: "gallery",
        createdByUserId: userId,
        status: "approved",
      },
    ]);
    await db.insert(legalEntityMember).values([
      { legalEntityId: personalId, userId, role: "owner", acceptedAt: now },
      { legalEntityId: northId, userId, role: "buyer_agent", acceptedAt: now },
      { legalEntityId: formerId, userId, role: "admin", acceptedAt: now, removedAt: now },
    ]);
    const lotBase = {
      title: "Sun over Arles",
      images: [],
      auctionType: "english" as const,
      startingPrice: "100.00",
      currentPrice: "100.00",
      minBidIncrement: "10.00",
      startTime: new Date(now.getTime() - 3_600_000),
      endTime: new Date(now.getTime() + 3_600_000),
      sellerLegalEntityId: personalId,
    };
    await db.insert(lot).values([
      { ...lotBase, id: openLotId, status: "active" },
      { ...lotBase, id: closedLotId, status: "ended" },
    ]);
    const n = (type: string, legalEntityId: string | null, extra = {}) => ({
      userId,
      type,
      title: type,
      message: type,
      legalEntityId,
      ...extra,
    });
    await db.insert(notification).values([
      n("outbid", northId, { lotId: openLotId, createdAt: new Date(now.getTime() - 1000) }),
      n("outbid", northId, { lotId: closedLotId, createdAt: new Date(now.getTime() - 2000) }),
      n("payment_due", personalId, { createdAt: new Date(now.getTime() - 3000) }),
      n("lot_won", formerId, { createdAt: new Date(now.getTime() - 4000) }),
      n("kyc_resubmission_required", null, {
        read: true,
        createdAt: new Date(now.getTime() - 5000),
      }),
    ]);
  });

  afterAll(async () => {
    await db.delete(notification).where(eq(notification.userId, userId));
    await mutes.unmute(userId, northId);
    await db.delete(lot).where(inArray(lot.id, [openLotId, closedLotId]));
    await db
      .delete(legalEntityMember)
      .where(inArray(legalEntityMember.legalEntityId, [personalId, northId, formerId]));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [personalId, northId, formerId]));
    await db.delete(user).where(eq(user.id, userId));
  });

  const page = { limit: 20, offset: 0 } as const;

  it("returns each notification's account and whether the person can switch to it", async () => {
    const rows = await reader.findByUserFiltered(userId, { ...page, tab: "all" });
    expect(rows.map((r) => [r.type, r.account?.displayName ?? null, r.account?.canSwitch])).toEqual(
      [
        ["outbid", "Northbank Gallery", true],
        ["outbid", "Northbank Gallery", true],
        ["payment_due", "Ada Lovelace", true],
        // A former member can see the old notice but not switch to that account.
        ["lot_won", "Harrington Advisors", false],
        ["kyc_resubmission_required", null, undefined],
      ],
    );
    expect(rows[0]?.account?.kind).toBe("organisation");
    expect(rows[2]?.account?.kind).toBe("personal");
  });

  it("shows only unread notices that ask for action, and outbids only while the lot is open", async () => {
    const rows = await reader.findByUserFiltered(userId, { ...page, tab: "needs_action" });
    expect(rows.map((r) => [r.type, r.lotId])).toEqual([
      ["outbid", openLotId],
      ["payment_due", null],
    ]);
    expect(rows.every((r) => r.needsAction)).toBe(true);
    const all = await reader.findByUserFiltered(userId, { ...page, tab: "all" });
    expect(all.filter((r) => r.needsAction)).toHaveLength(2);
  });

  it("counts what needs action and what is unread, for every account or one", async () => {
    expect(await reader.countByUser(userId, {})).toEqual({ needsAction: 2, unread: 4 });
    expect(
      await reader.countByUser(userId, { account: { kind: "entity", legalEntityId: northId } }),
    ).toEqual({ needsAction: 1, unread: 2 });
  });

  it("finds words in the title or message, treating % as a character", async () => {
    const found = await reader.findByUserFiltered(userId, {
      ...page,
      tab: "all",
      query: "PAYMENT",
    });
    expect(found.map((r) => r.type)).toEqual(["payment_due"]);
    const none = await reader.findByUserFiltered(userId, { ...page, tab: "all", query: "%" });
    expect(none).toEqual([]);
  });

  it("filters by one organisation or by the person's own account", async () => {
    const north = await reader.findByUserFiltered(userId, {
      ...page,
      tab: "all",
      account: { kind: "entity", legalEntityId: northId },
    });
    expect(north.map((r) => r.type)).toEqual(["outbid", "outbid"]);
    const personal = await reader.findByUserFiltered(userId, {
      ...page,
      tab: "all",
      account: { kind: "personal" },
    });
    expect(personal.map((r) => r.type)).toEqual(["payment_due", "kyc_resubmission_required"]);
  });

  it("mutes only organisations the person belongs to, and stops delivery about them", async () => {
    expect(await mutes.isMemberOfOrganisation(userId, northId)).toBe(true);
    expect(await mutes.isMemberOfOrganisation(userId, personalId)).toBe(false);
    expect(await mutes.isMemberOfOrganisation(userId, formerId)).toBe(false);

    await mutes.mute(userId, northId);
    await mutes.mute(userId, northId);
    expect(await mutes.listForUser(userId)).toMatchObject([
      { legalEntityId: northId, displayName: "Northbank Gallery" },
    ]);

    const written = await writer.createMany([
      { userId, type: "outbid", title: "t", message: "m", legalEntityId: northId },
      { userId, type: "outbid", title: "t", message: "m", legalEntityId: personalId },
    ]);
    expect(written.map((r) => r.legalEntityId)).toEqual([personalId]);

    expect(await mutes.unmute(userId, northId)).toBe(true);
    expect(await mutes.unmute(userId, northId)).toBe(false);
  });
});
