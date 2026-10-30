import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  artistProfile,
  artistWatchlist,
  bidIdentityDirectory,
  deliveryQuote,
  legalEntity,
  lot,
  lotFulfilment,
  payment,
  sale,
  saleRegistration,
  user,
} from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleArtistWatchlistRepository } from "./drizzle-artist-watchlist.repository.js";
import { DrizzleDeliveryQuoteRepository } from "./drizzle-delivery-quote.repository.js";
import {
  DrizzleAccountPurchaseFactsReader,
  DrizzleAccountRegistrationsReader,
  DrizzleRecordPeopleReader,
} from "./drizzle-workspace-buying.readers.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("workspace buying readers (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const registrations = new DrizzleAccountRegistrationsReader(db);
  const purchases = new DrizzleAccountPurchaseFactsReader(db);
  const people = new DrizzleRecordPeopleReader(db);
  const quotes = new DrizzleDeliveryQuoteRepository(db);
  const watchlist = new DrizzleArtistWatchlistRepository(db);

  const ownerId = `wsb-owner-${randomUUID()}`;
  const agentId = `wsb-agent-${randomUUID()}`;
  const orgId = randomUUID();
  const otherOrgId = randomUUID();
  const sellerId = randomUUID();
  const saleId = randomUUID();
  const artistId = randomUUID();
  const lots = { paid: randomUUID(), due: randomUUID(), agent: randomUUID(), other: randomUUID() };
  const now = new Date("2026-11-10T12:00:00Z");
  const day = 86_400_000;

  const wonLot = (id: string, winnerId: string, buyer: string, price: string) => ({
    id,
    saleId,
    title: `Won ${id.slice(0, 4)}`,
    images: [],
    auctionType: "english" as const,
    startingPrice: "100.00",
    currentPrice: price,
    minBidIncrement: "10.00",
    startTime: new Date(now.getTime() - 3 * day),
    endTime: new Date(now.getTime() - day),
    status: "ended" as const,
    sellerLegalEntityId: sellerId,
    winnerId,
    buyerLegalEntityId: buyer,
  });

  beforeAll(async () => {
    for (const [id, name] of [
      [ownerId, "Maya Okafor"],
      [agentId, "Tom Whitfield"],
    ] as const) {
      await db.insert(user).values({
        id,
        name,
        email: `${id}@integration.test`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
      await db
        .insert(bidIdentityDirectory)
        .values({ subjectId: id, email: `${id}@integration.test`, name, identityCreatedAt: now })
        .onConflictDoNothing();
    }
    for (const [id, kind, subkind] of [
      [orgId, "organisation", "gallery"],
      [otherOrgId, "organisation", "gallery"],
      [sellerId, "individual", "private_collector"],
    ] as const) {
      await db.insert(legalEntity).values({
        id,
        displayName: `Buying ${id.slice(0, 4)}`,
        kind,
        subkind,
        createdByUserId: ownerId,
        status: "approved",
      });
    }
    await db.insert(sale).values({
      id: saleId,
      title: "Spring Modern British",
      createdByLegalEntityId: sellerId,
      startTime: new Date(now.getTime() + 5 * day),
      endTime: new Date(now.getTime() + 6 * day),
    });
    await db.insert(saleRegistration).values([
      { saleId, userId: ownerId, buyerLegalEntityId: orgId, status: "approved", paddleNumber: 12 },
      { saleId, userId: agentId, buyerLegalEntityId: orgId, status: "pending" },
      { saleId, userId: agentId, buyerLegalEntityId: otherOrgId, status: "approved" },
    ]);
    await db
      .insert(lot)
      .values([
        wonLot(lots.paid, ownerId, orgId, "4000.00"),
        wonLot(lots.due, ownerId, orgId, "1500.00"),
        wonLot(lots.agent, agentId, orgId, "900.00"),
        wonLot(lots.other, agentId, otherOrgId, "700.00"),
      ]);
    await db.insert(payment).values([
      {
        lotId: lots.paid,
        buyerId: ownerId,
        buyerLegalEntityId: orgId,
        sellerLegalEntityId: sellerId,
        amount: "5000.00",
        platformFee: "250.00",
        status: "captured",
        createdAt: new Date(now.getTime() - day),
      },
      // A cancelled invoice next to the open one: the open one is the invoice.
      {
        lotId: lots.due,
        buyerId: ownerId,
        buyerLegalEntityId: orgId,
        sellerLegalEntityId: sellerId,
        amount: "1800.00",
        platformFee: "90.00",
        status: "pending",
        createdAt: new Date(now.getTime() - 2 * day),
      },
      {
        lotId: lots.due,
        buyerId: ownerId,
        buyerLegalEntityId: orgId,
        sellerLegalEntityId: sellerId,
        amount: "1800.00",
        platformFee: "90.00",
        status: "cancelled",
        createdAt: new Date(now.getTime() - day),
      },
    ]);
    await db
      .insert(lotFulfilment)
      .values({ lotId: lots.paid, status: "released", fulfilmentMethod: "collection" });
    await db
      .insert(artistProfile)
      .values({ id: artistId, displayName: "A. Artist", slug: `a-${artistId}` });
  });

  afterAll(async () => {
    const lotIds = Object.values(lots);
    await db.delete(deliveryQuote).where(inArray(deliveryQuote.lotId, lotIds));
    await db.delete(lotFulfilment).where(inArray(lotFulfilment.lotId, lotIds));
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.delete(saleRegistration).where(eq(saleRegistration.saleId, saleId));
    await db.delete(sale).where(eq(sale.id, saleId));
    await db.delete(artistWatchlist).where(eq(artistWatchlist.artistId, artistId));
    await db.delete(artistProfile).where(eq(artistProfile.id, artistId));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [orgId, otherOrgId, sellerId]));
    await db
      .delete(bidIdentityDirectory)
      .where(inArray(bidIdentityDirectory.subjectId, [ownerId, agentId]));
    await db.delete(user).where(inArray(user.id, [ownerId, agentId]));
  });

  it("lists the account's registrations with who registered, never another account's", async () => {
    const rows = await registrations.list({ legalEntityId: orgId, memberUserId: null });
    expect(rows.map((r) => [r.registeredBy.name, r.status, r.paddleNumber]).sort()).toEqual([
      ["Maya Okafor", "approved", 12],
      ["Tom Whitfield", "pending", null],
    ]);
    expect(rows[0]?.saleTitle).toBe("Spring Modern British");
  });

  it("narrows registrations to one member", async () => {
    const rows = await registrations.list({ legalEntityId: orgId, memberUserId: agentId });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("pending");
  });

  it("names people by id", async () => {
    const names = await people.namesFor([ownerId, agentId, ownerId, "nobody"]);
    expect(names.get(ownerId)).toBe("Maya Okafor");
    expect(names.get(agentId)).toBe("Tom Whitfield");
    expect(names.has("nobody")).toBe(false);
  });

  it("reads each won lot with its winner, invoice and fulfilment", async () => {
    const rows = await purchases.list({
      legalEntityId: orgId,
      memberUserId: null,
      limit: 50,
      offset: 0,
    });
    expect(rows.map((r) => r.lotId).sort()).toEqual([lots.agent, lots.due, lots.paid].sort());
    const paid = rows.find((r) => r.lotId === lots.paid);
    expect(paid).toMatchObject({
      buyerAccountKind: "organisation",
      wonBy: { userId: ownerId, name: "Maya Okafor" },
      payment: { status: "captured", amount: "5000.00" },
      fulfilment: { status: "released", method: "collection" },
      quote: null,
    });
    const due = rows.find((r) => r.lotId === lots.due);
    expect(due?.payment?.status).toBe("pending");
    expect(rows.find((r) => r.lotId === lots.agent)?.payment).toBeNull();
  });

  it("narrows purchases to one member's wins and to picked lots", async () => {
    const own = await purchases.list({
      legalEntityId: orgId,
      memberUserId: agentId,
      limit: 50,
      offset: 0,
    });
    expect(own.map((r) => r.lotId)).toEqual([lots.agent]);
    const picked = await purchases.list({
      legalEntityId: orgId,
      memberUserId: null,
      lotIds: [lots.due, lots.other],
      limit: 50,
      offset: 0,
    });
    expect(picked.map((r) => r.lotId)).toEqual([lots.due]);
  });

  it("runs a quote through request, price and accept, refusing stale steps", async () => {
    const requested = await quotes.insertRequested({
      lotId: lots.due,
      buyerLegalEntityId: orgId,
      destination: "12 Gallery Row, London",
      currency: "GBP",
      requestedByUserId: ownerId,
    });
    expect(requested?.status).toBe("requested");
    const second = await quotes.insertRequested({
      lotId: lots.due,
      buyerLegalEntityId: orgId,
      destination: "elsewhere",
      currency: "GBP",
      requestedByUserId: ownerId,
    });
    expect(second).toBeNull();
    if (!requested) throw new Error("expected a request");

    const quoted = await quotes.transition(requested.id, "requested", {
      status: "quoted",
      actorUserId: agentId,
      amount: "240.00",
      quoteNote: "Fine art courier, 3 to 5 working days",
    });
    expect(quoted).toMatchObject({ status: "quoted", amount: "240.00" });
    expect(
      await quotes.transition(requested.id, "requested", {
        status: "withdrawn",
        actorUserId: ownerId,
      }),
    ).toBeNull();

    const accepted = await quotes.transition(requested.id, "quoted", {
      status: "accepted",
      actorUserId: ownerId,
    });
    expect(accepted).toMatchObject({ status: "accepted", decidedByUserId: ownerId });
    expect((await quotes.findLatest(lots.due, orgId))?.status).toBe("accepted");

    const [due] = await purchases.list({
      legalEntityId: orgId,
      memberUserId: null,
      lotIds: [lots.due],
      limit: 1,
      offset: 0,
    });
    expect(due?.quote).toMatchObject({ status: "accepted", amount: "240.00" });
  });

  it("stores and clears artist alert criteria for a followed artist only", async () => {
    expect(
      await watchlist.setAlert(ownerId, artistId, {
        medium: "oil",
        priceMin: null,
        priceMax: null,
      }),
    ).toBeNull();
    await watchlist.add(ownerId, artistId);
    const set = await watchlist.setAlert(ownerId, artistId, {
      medium: "oil",
      priceMin: "1000.00",
      priceMax: "5000.00",
    });
    expect(set?.alert).toEqual({ medium: "oil", priceMin: "1000.00", priceMax: "5000.00" });
    const cleared = await watchlist.setAlert(ownerId, artistId, {
      medium: null,
      priceMin: null,
      priceMax: null,
    });
    expect(cleared?.alert).toEqual({ medium: null, priceMin: null, priceMax: null });
  });
});
