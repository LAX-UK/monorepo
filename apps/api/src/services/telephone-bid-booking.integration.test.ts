import { createDb } from "@auction/db";
import {
  bid,
  legalEntity,
  legalEntityMember,
  lot,
  sale,
  telephoneBidBooking,
  user,
} from "@auction/db/schema";
import { DrizzleLotRepository, DrizzleSaleRepository, DrizzleTelephoneBidBookingDetailReader, DrizzleTelephoneBidBookingRepository, DrizzleTelephoneBookingUserPhoneReader, createDrizzleLegalEntityRepository } from "@auction/persistence/repositories";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTelephoneBidBookingService } from "./telephone-bid-booking.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("TelephoneBidBookingService (integration)", () => {
  const buyerUserId = "tel_int_buyer_u";
  const staffUserId = "tel_int_staff_u";
  const buyerLeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const sellerLeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const saleId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const lotId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const otherLotId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleTelephoneBidBookingRepository(db);
  const legalEntityRepository = createDrizzleLegalEntityRepository(db);
  const saleRepo = new DrizzleSaleRepository(db);
  const lotRepo = new DrizzleLotRepository(db);
  const service = buildTelephoneBidBookingService({
    repo,
    detailReader: new DrizzleTelephoneBidBookingDetailReader(db),
    saleRepo,
    lotRepo,
    userPhoneReader: new DrizzleTelephoneBookingUserPhoneReader(db),
    legalEntityRepository,
  });

  async function cleanup() {
    await db.delete(bid).where(eq(bid.lotId, lotId));
    await db.delete(telephoneBidBooking).where(eq(telephoneBidBooking.saleId, saleId));
    await db.delete(lot).where(eq(lot.saleId, saleId));
    await db.delete(sale).where(eq(sale.id, saleId));
    await db
      .delete(legalEntityMember)
      .where(sql`${legalEntityMember.legalEntityId} IN (${buyerLeId}::uuid, ${sellerLeId}::uuid)`);
    await db
      .delete(legalEntity)
      .where(sql`${legalEntity.id} IN (${buyerLeId}::uuid, ${sellerLeId}::uuid)`);
    await db.delete(user).where(sql`${user.id} IN (${buyerUserId}, ${staffUserId})`);
  }

  async function seedBase() {
    const t = new Date();
    await db.insert(user).values([
      {
        id: buyerUserId,
        name: "Tel Buyer",
        email: "tel_int_buyer@integration.test",
        emailVerified: true,
        phoneNumber: "+447700900123",
        phoneNumberVerified: true,
        mobile: "+447700900123",
        createdAt: t,
        updatedAt: t,
      },
      {
        id: staffUserId,
        name: "Tel Staff",
        email: "tel_int_staff@integration.test",
        emailVerified: true,
        role: "staff",
        staffRole: "super_admin",
        createdAt: t,
        updatedAt: t,
      },
    ]);
    await db.insert(legalEntity).values([
      {
        id: sellerLeId,
        displayName: "Tel Seller Gallery",
        kind: "organisation",
        subkind: "gallery",
        createdByUserId: staffUserId,
        status: "approved",
        createdAt: t,
        updatedAt: t,
      },
      {
        id: buyerLeId,
        displayName: "Tel Buyer",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: buyerUserId,
        status: "approved",
        createdAt: t,
        updatedAt: t,
      },
    ]);
    await db.insert(legalEntityMember).values([
      {
        legalEntityId: buyerLeId,
        userId: buyerUserId,
        role: "owner",
        isPrimaryAdmin: true,
        acceptedAt: t,
        createdAt: t,
      },
    ]);
    await db.insert(sale).values({
      id: saleId,
      title: "Tel integration sale",
      status: "scheduled",
      deliveryMode: "onsite",
      allowOnlineBidsBeforeGoLive: false,
      startTime: new Date(t.getTime() + 86_400_000),
      endTime: new Date(t.getTime() + 172_800_000),
      createdByLegalEntityId: sellerLeId,
      createdAt: t,
      updatedAt: t,
    });
    await db.insert(lot).values([
      {
        id: lotId,
        saleId,
        sellerLegalEntityId: sellerLeId,
        title: "Tel lot A",
        images: [],
        auctionType: "english",
        startingPrice: "100.00",
        currentPrice: "100.00",
        minBidIncrement: "10.00",
        startTime: new Date(t.getTime() + 86_400_000),
        endTime: new Date(t.getTime() + 172_800_000),
        status: "scheduled",
        createdAt: t,
        updatedAt: t,
      },
      {
        id: otherLotId,
        saleId,
        sellerLegalEntityId: sellerLeId,
        title: "Tel lot B",
        images: [],
        auctionType: "english",
        startingPrice: "200.00",
        currentPrice: "200.00",
        minBidIncrement: "10.00",
        startTime: new Date(t.getTime() + 86_400_000),
        endTime: new Date(t.getTime() + 172_800_000),
        status: "scheduled",
        createdAt: t,
        updatedAt: t,
      },
    ]);
  }

  beforeAll(async () => {
    await cleanup();
    await seedBase();
  });

  afterAll(async () => {
    await cleanup();
  });

  it("runs request → confirm → bid gate → hammer cleanup", async () => {
    await db.delete(telephoneBidBooking).where(eq(telephoneBidBooking.saleId, saleId));

    const requested = await service.requestBooking({
      userId: buyerUserId,
      saleId,
      buyerLegalEntityId: buyerLeId,
      lotIds: [lotId],
      authorizedMax: 5000,
    });
    expect(requested.isOk()).toBe(true);
    if (!requested.isOk()) return;
    expect(requested.value.status).toBe("requested");
    expect(requested.value.phoneE164).toBe("+447700900123");

    const confirmed = await service.confirm({
      bookingId: requested.value.id,
      staffUserId,
    });
    expect(confirmed.isOk()).toBe(true);
    if (!confirmed.isOk()) return;
    expect(confirmed.value.status).toBe("confirmed");

    const started = await service.startLine({
      bookingId: requested.value.id,
      staffUserId,
      lotId,
    });
    expect(started.isOk()).toBe(true);
    if (!started.isOk()) return;
    expect(started.value.status).toBe("in_progress");

    const bidGate = await service.assertBookingAllowsTelephoneBid({
      bookingId: requested.value.id,
      saleId,
      lotId,
      amount: 150,
    });
    expect(bidGate.isOk()).toBe(true);

    const overCap = await service.assertBookingAllowsTelephoneBid({
      bookingId: requested.value.id,
      saleId,
      lotId,
      amount: 6000,
    });
    expect(overCap.isErr()).toBe(true);
    if (overCap.isErr()) {
      expect(overCap.error.code).toBe("authorized_max_exceeded");
    }

    const hammered = await service.completeLinesForLot(saleId, lotId);
    expect(hammered).toBe(1);

    const afterHammer = await repo.findById(requested.value.id);
    expect(afterHammer?.status).toBe("confirmed");
    expect(afterHammer?.completedLotIds).toContain(lotId);
  });

  it("removes withdrawn lot from active telephone bookings", async () => {
    await db.delete(telephoneBidBooking).where(eq(telephoneBidBooking.saleId, saleId));

    const requested = await service.requestBooking({
      userId: buyerUserId,
      saleId,
      buyerLegalEntityId: buyerLeId,
      lotIds: [lotId, otherLotId],
    });
    expect(requested.isOk()).toBe(true);
    if (!requested.isOk()) return;

    const removed = await service.removeLotFromActiveBookings(saleId, lotId);
    expect(removed).toBe(1);

    const updated = await repo.findById(requested.value.id);
    expect(updated?.lotIds).toEqual([otherLotId]);
  });
});
