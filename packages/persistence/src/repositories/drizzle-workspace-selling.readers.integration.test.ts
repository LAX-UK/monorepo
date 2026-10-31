import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  itemSubmission,
  legalEntity,
  lot,
  payment,
  payout,
  payoutLine,
  unsoldChoiceDeadline,
  unsoldLotChoice,
  user,
} from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleUnsoldChoiceDeadlineStore } from "./drizzle-unsold-choice-deadline.store.js";
import {
  DrizzleAgreementDocumentFactsReader,
  DrizzlePayoutLinesReader,
  DrizzleReturnedWorksReader,
  DrizzleSoldLotsReader,
} from "./drizzle-workspace-selling.readers.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("workspace selling readers (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const sold = new DrizzleSoldLotsReader(db);
  const lines = new DrizzlePayoutLinesReader(db);
  const returned = new DrizzleReturnedWorksReader(db);
  const facts = new DrizzleAgreementDocumentFactsReader(db);
  const deadlines = new DrizzleUnsoldChoiceDeadlineStore(db);

  const sellerUser = `wss-seller-${randomUUID()}`;
  const buyerUser = `wss-buyer-${randomUUID()}`;
  const sellerOrg = randomUUID();
  const otherOrg = randomUUID();
  const buyerOrg = randomUUID();
  const lots = {
    paidOut: randomUUID(),
    awaiting: randomUUID(),
    unsold: randomUUID(),
    otherSeller: randomUUID(),
  };
  const submissions = { unsold: randomUUID(), paidOut: randomUUID() };
  const payoutId = randomUUID();
  const now = new Date("2026-11-10T12:00:00Z");
  const day = 86_400_000;

  const endedLot = (id: string, seller: string, winner: string | null, price: string) => ({
    id,
    title: `Sold ${id.slice(0, 4)}`,
    images: [],
    auctionType: "english" as const,
    startingPrice: "100.00",
    currentPrice: price,
    minBidIncrement: "10.00",
    startTime: new Date(now.getTime() - 3 * day),
    endTime: new Date(now.getTime() - day),
    status: "ended" as const,
    sellerLegalEntityId: seller,
    winnerId: winner,
    buyerLegalEntityId: winner ? buyerOrg : null,
  });

  beforeAll(async () => {
    for (const id of [sellerUser, buyerUser]) {
      await db.insert(user).values({
        id,
        name: id,
        email: `${id}@integration.test`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const [id, name] of [
      [sellerOrg, "Northbank Gallery"],
      [otherOrg, "Elsewhere"],
      [buyerOrg, "Buyer"],
    ] as const) {
      await db.insert(legalEntity).values({
        id,
        displayName: name,
        kind: "organisation",
        subkind: "gallery",
        createdByUserId: sellerUser,
        status: "approved",
      });
    }
    await db
      .insert(lot)
      .values([
        endedLot(lots.paidOut, sellerOrg, buyerUser, "4000.00"),
        endedLot(lots.awaiting, sellerOrg, buyerUser, "900.00"),
        endedLot(lots.unsold, sellerOrg, null, "500.00"),
        endedLot(lots.otherSeller, otherOrg, buyerUser, "100.00"),
      ]);
    await db.insert(itemSubmission).values([
      {
        id: submissions.unsold,
        legalEntityId: sellerOrg,
        title: "Harbour at Dusk",
        status: "converted",
        convertedLotId: lots.unsold,
        submittedByUserId: sellerUser,
      },
      {
        id: submissions.paidOut,
        legalEntityId: sellerOrg,
        title: "Field",
        status: "converted",
        convertedLotId: lots.paidOut,
        submittedByUserId: sellerUser,
      },
    ]);
    const [paid] = await db
      .insert(payment)
      .values({
        lotId: lots.paidOut,
        buyerId: buyerUser,
        buyerLegalEntityId: buyerOrg,
        sellerLegalEntityId: sellerOrg,
        amount: "5000.00",
        platformFee: "1000.00",
        status: "captured",
      })
      .returning();
    await db.insert(payment).values({
      lotId: lots.awaiting,
      buyerId: buyerUser,
      buyerLegalEntityId: buyerOrg,
      sellerLegalEntityId: sellerOrg,
      amount: "1100.00",
      platformFee: "200.00",
      status: "pending",
    });
    await db.insert(payout).values({
      id: payoutId,
      legalEntityId: sellerOrg,
      periodStart: new Date(now.getTime() - 7 * day),
      periodEnd: now,
      grossAmount: "5000.00",
      platformFee: "1000.00",
      stripeFee: "0.00",
      netAmount: "4000.00",
      status: "paid",
      processedAt: now,
    });
    await db.insert(payoutLine).values({
      payoutId,
      // biome-ignore lint/style/noNonNullAssertion: inserted above
      paymentId: paid!.id,
      amount: "5000.00",
      kind: "sale",
    });
    await db.insert(unsoldLotChoice).values({
      lotId: lots.unsold,
      submissionId: submissions.unsold,
      legalEntityId: sellerOrg,
      lotEndTime: new Date(now.getTime() - day),
      status: "confirmed",
      decidedChoice: "collect",
      decidedAt: now,
    });
  });

  afterAll(async () => {
    const lotIds = Object.values(lots);
    await db.delete(payoutLine).where(eq(payoutLine.payoutId, payoutId));
    await db.delete(payout).where(eq(payout.id, payoutId));
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(unsoldLotChoice).where(inArray(unsoldLotChoice.lotId, lotIds));
    await db.delete(unsoldChoiceDeadline).where(inArray(unsoldChoiceDeadline.lotId, lotIds));
    await db.delete(itemSubmission).where(inArray(itemSubmission.id, Object.values(submissions)));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [sellerOrg, otherOrg, buyerOrg]));
    await db.delete(user).where(inArray(user.id, [sellerUser, buyerUser]));
  });

  it("lists the account's sold lots with the buyer's payment and the payout", async () => {
    const rows = await sold.list({ legalEntityId: sellerOrg, limit: 50, offset: 0 });
    expect(rows.map((r) => r.lotId).sort()).toEqual([lots.paidOut, lots.awaiting].sort());
    expect(rows.find((r) => r.lotId === lots.paidOut)).toMatchObject({
      hammerPrice: "4000.00",
      payment: { status: "captured", amount: "5000.00", platformFee: "1000.00" },
      payout: { id: payoutId, status: "paid" },
    });
    expect(rows.find((r) => r.lotId === lots.awaiting)).toMatchObject({
      payment: { status: "pending" },
      payout: null,
    });
  });

  it("reads a payout's lines with their lot and payment, only for its account", async () => {
    const found = await lines.find(sellerOrg, payoutId);
    expect(found?.lines).toEqual([
      expect.objectContaining({
        kind: "sale",
        amount: "5000.00",
        lot: expect.objectContaining({ id: lots.paidOut, hammerPrice: "4000.00" }),
        payment: { amount: "5000.00", platformFee: "1000.00" },
      }),
    ]);
    expect(await lines.find(otherOrg, payoutId)).toBeNull();
  });

  it("lists works coming back unsold, with their reference", async () => {
    const rows = await returned.list({
      legalEntityId: sellerOrg,
      visibleTo: undefined,
      limit: 50,
      offset: 0,
    });
    expect(rows).toEqual([
      expect.objectContaining({ submissionId: submissions.unsold, title: "Harbour at Dusk" }),
    ]);
    expect(rows[0]?.referenceNumber).toBeGreaterThan(1000);
    expect(
      await returned.list({
        legalEntityId: sellerOrg,
        visibleTo: { scope: "own", userId: buyerUser },
        limit: 50,
        offset: 0,
      }),
    ).toEqual([]);
  });

  it("names the agreement's work, reference and seller", async () => {
    expect(await facts.factsFor(submissions.unsold)).toMatchObject({
      workTitle: "Harbour at Dusk",
      sellerName: "Northbank Gallery",
      legalEntityId: sellerOrg,
    });
  });

  it("finds a consigned lot's unsold outcome, and none for a sold lot", async () => {
    expect(await deadlines.unsoldOutcomeOf(lots.unsold)).toEqual({
      lotId: lots.unsold,
      lotEndTime: new Date(now.getTime() - day),
    });
    expect(await deadlines.unsoldOutcomeOf(lots.paidOut)).toBeNull();
  });

  it("keeps the first unsold-choice date and never moves it", async () => {
    const key = { lotId: lots.unsold, lotEndTime: new Date(now.getTime() - day) };
    const first = new Date(now.getTime() + 13 * day);
    expect(await deadlines.keep([{ ...key, chooseBy: first }])).toEqual([
      { ...key, chooseBy: first },
    ]);
    const later = new Date(now.getTime() + 30 * day);
    expect(await deadlines.keep([{ ...key, chooseBy: later }])).toEqual([
      { ...key, chooseBy: first },
    ]);
    expect(await deadlines.kept([key])).toEqual([{ ...key, chooseBy: first }]);
  });
});
