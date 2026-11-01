import { type Database, createDb } from "@auction/db";
import {
  absenteeBid,
  bid,
  itemSubmission,
  legalEntity,
  lot,
  payment,
  payout,
  payoutLine,
  sale,
  user,
} from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleConsignmentStatusCountsReader } from "./drizzle-consignment-status-counts.reader.js";
import { DrizzlePayoutsDueReader } from "./drizzle-payouts-due.reader.js";
import { DrizzleSoldWorksReader } from "./drizzle-sold-works.reader.js";
import { DrizzleUpcomingSaleWorksReader } from "./drizzle-upcoming-sale-works.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const OWNER = "dash-it-owner";
const CONSIGNOR_A = "dash-it-consignor-a";
const CONSIGNOR_B = "dash-it-consignor-b";
const AGENT = "dash-it-agent";
const OTHER = "dash-it-other";

const ORG = "da5b0000-0000-4000-8000-000000000001";
const OTHER_ORG = "da5b0000-0000-4000-8000-000000000002";
const SALE_UPCOMING = "da5b0000-0000-4000-8000-0000000000a1";
const SALE_PAST = "da5b0000-0000-4000-8000-0000000000a2";

const NOW = new Date("2026-10-28T12:00:00Z");
const T = new Date("2026-01-05T00:00:00Z");

/** Lot ids, by what they are for. */
const L = {
  inSaleA: "da5b0000-0000-4000-8000-000000000101",
  inSaleB: "da5b0000-0000-4000-8000-000000000102",
  inSaleStaff: "da5b0000-0000-4000-8000-000000000103",
  soldA: "da5b0000-0000-4000-8000-000000000104",
  soldLastYear: "da5b0000-0000-4000-8000-000000000105",
  unsoldB: "da5b0000-0000-4000-8000-000000000106",
  soldEuro: "da5b0000-0000-4000-8000-000000000107",
  cancelled: "da5b0000-0000-4000-8000-000000000108",
  deleted: "da5b0000-0000-4000-8000-000000000109",
  otherOrgInSale: "da5b0000-0000-4000-8000-000000000110",
  otherOrgEuro: "da5b0000-0000-4000-8000-000000000111",
  wonUnpaid: "da5b0000-0000-4000-8000-000000000112",
  wonPaid: "da5b0000-0000-4000-8000-000000000113",
};

type LotSeed = {
  id: string;
  seller: string;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled";
  saleId?: string;
  price?: string;
  endTime?: Date;
  winnerId?: string;
  buyer?: string;
  estimate?: { low: string; high: string; currency: string };
  deleted?: boolean;
};

const LOTS: LotSeed[] = [
  {
    id: L.inSaleA,
    seller: ORG,
    status: "scheduled",
    saleId: SALE_UPCOMING,
    estimate: { low: "1000", high: "1500", currency: "GBP" },
  },
  {
    id: L.inSaleB,
    seller: ORG,
    status: "active",
    saleId: SALE_UPCOMING,
    estimate: { low: "2000", high: "3000", currency: "eur" },
  },
  { id: L.inSaleStaff, seller: ORG, status: "scheduled", saleId: SALE_UPCOMING },
  {
    id: L.soldA,
    seller: ORG,
    status: "ended",
    saleId: SALE_PAST,
    price: "5000",
    endTime: new Date("2026-03-10T18:00:00Z"),
    winnerId: OTHER,
  },
  {
    id: L.soldLastYear,
    seller: ORG,
    status: "ended",
    price: "999",
    endTime: new Date("2025-12-31T23:30:00Z"),
    winnerId: OTHER,
  },
  { id: L.unsoldB, seller: ORG, status: "ended", saleId: SALE_PAST },
  {
    id: L.soldEuro,
    seller: ORG,
    status: "ended",
    price: "3000",
    endTime: new Date("2026-05-01T18:00:00Z"),
    winnerId: OTHER,
    estimate: { low: "2500", high: "3500", currency: "EUR" },
  },
  { id: L.cancelled, seller: ORG, status: "cancelled" },
  { id: L.deleted, seller: ORG, status: "scheduled", saleId: SALE_UPCOMING, deleted: true },
  { id: L.otherOrgInSale, seller: OTHER_ORG, status: "scheduled", saleId: SALE_UPCOMING },
  {
    id: L.otherOrgEuro,
    seller: OTHER_ORG,
    status: "active",
    saleId: SALE_UPCOMING,
    estimate: { low: "900", high: "1200", currency: "EUR" },
  },
  {
    id: L.wonUnpaid,
    seller: OTHER_ORG,
    status: "ended",
    price: "400",
    winnerId: OWNER,
    buyer: ORG,
  },
  { id: L.wonPaid, seller: OTHER_ORG, status: "ended", price: "700", winnerId: OWNER, buyer: ORG },
];

async function seed(tx: Database) {
  for (const id of [OWNER, CONSIGNOR_A, CONSIGNOR_B, AGENT, OTHER]) {
    await tx.insert(user).values({
      id,
      name: id,
      email: `${id}@integration.test`,
      emailVerified: true,
      createdAt: T,
      updatedAt: T,
    });
  }
  for (const [id, name] of [
    [ORG, "Northbank Gallery"],
    [OTHER_ORG, "Elsewhere Ltd"],
  ] as const) {
    await tx.insert(legalEntity).values({
      id,
      displayName: name,
      kind: "organisation",
      subkind: "gallery",
      createdByUserId: OWNER,
      status: "approved",
      createdAt: T,
      updatedAt: T,
    });
  }
  await tx.insert(sale).values([
    {
      id: SALE_UPCOMING,
      title: "Modern British",
      status: "scheduled",
      startTime: new Date("2026-11-20T10:00:00Z"),
      endTime: new Date("2026-11-21T18:00:00Z"),
      createdByLegalEntityId: ORG,
    },
    {
      id: SALE_PAST,
      title: "Spring Sale",
      status: "ended",
      startTime: new Date("2026-03-09T10:00:00Z"),
      endTime: new Date("2026-03-10T18:00:00Z"),
      createdByLegalEntityId: ORG,
    },
  ]);
  for (const seed of LOTS) {
    await tx.insert(lot).values({
      id: seed.id,
      sellerLegalEntityId: seed.seller,
      saleId: seed.saleId ?? null,
      title: seed.id,
      auctionType: "english",
      startingPrice: "100",
      currentPrice: seed.price ?? "100",
      startTime: new Date("2025-06-01T10:00:00Z"),
      endTime: seed.endTime ?? new Date("2026-11-21T18:00:00Z"),
      status: seed.status,
      winnerId: seed.winnerId ?? null,
      buyerLegalEntityId: seed.buyer ?? null,
      marketingDetails: seed.estimate ? { estimate: seed.estimate } : {},
      deletedAt: seed.deleted ? T : null,
    });
  }
  const submission = (
    status: (typeof itemSubmission.$inferInsert)["status"],
    by: string | null,
    convertedLotId: string | null = null,
  ) => ({
    legalEntityId: ORG,
    title: `${status} by ${by ?? "nobody"}`,
    status,
    submittedByUserId: by,
    convertedLotId,
  });
  await tx
    .insert(itemSubmission)
    .values([
      submission("under_review", CONSIGNOR_A),
      submission("changes_requested", CONSIGNOR_A),
      submission("approved", CONSIGNOR_B),
      submission("submitted", null),
      submission("draft", CONSIGNOR_A),
      submission("converted", CONSIGNOR_A, L.inSaleA),
      submission("converted", CONSIGNOR_B, L.inSaleB),
      submission("converted", CONSIGNOR_A, L.soldA),
      submission("converted", CONSIGNOR_B, L.unsoldB),
    ]);
  await tx.insert(bid).values([
    { lotId: L.otherOrgInSale, bidderId: AGENT, buyerLegalEntityId: ORG, amount: "200" },
    {
      lotId: L.otherOrgInSale,
      bidderId: AGENT,
      buyerLegalEntityId: ORG,
      amount: "250",
      isAutoBid: true,
      maxAutoBidAmount: "800",
    },
    { lotId: L.otherOrgInSale, bidderId: OWNER, buyerLegalEntityId: ORG, amount: "300" },
    { lotId: L.wonUnpaid, bidderId: OWNER, buyerLegalEntityId: ORG, amount: "400" },
    { lotId: L.otherOrgInSale, bidderId: OTHER, buyerLegalEntityId: OTHER_ORG, amount: "9000" },
  ]);
  await tx.insert(absenteeBid).values([
    { lotId: L.otherOrgEuro, userId: OWNER, buyerLegalEntityId: ORG, maxAmount: "1200" },
    {
      lotId: L.otherOrgInSale,
      userId: AGENT,
      buyerLegalEntityId: ORG,
      maxAmount: "5000",
      status: "cancelled",
    },
  ]);
  const payoutRow = (status: string, net: string, periodEnd: string, legalEntityId = ORG) => ({
    legalEntityId,
    periodStart: new Date("2026-10-01T00:00:00Z"),
    periodEnd: new Date(periodEnd),
    grossAmount: net,
    platformFee: "0",
    stripeFee: "0",
    netAmount: net,
    status,
  });
  const payouts = await tx
    .insert(payout)
    .values([
      payoutRow("scheduled", "900", "2026-11-03T00:00:00Z"),
      payoutRow("in_transit", "100", "2026-10-31T00:00:00Z"),
      payoutRow("paid", "500", "2026-10-15T00:00:00Z"),
      payoutRow("scheduled", "7000", "2026-10-30T00:00:00Z", OTHER_ORG),
    ])
    .returning({ id: payout.id, amount: payout.netAmount });
  // A payout pays out what its lines come to.
  await tx
    .insert(payoutLine)
    .values(
      payouts.map((row) => ({ payoutId: row.id, amount: row.amount, kind: "adjustment" as const })),
    );
  await tx.insert(payment).values({
    lotId: L.wonPaid,
    buyerId: OWNER,
    buyerLegalEntityId: ORG,
    sellerLegalEntityId: OTHER_ORG,
    amount: "875",
    platformFee: "0",
    status: "captured",
  });
}

async function inRollback(run: (db: Database) => Promise<void>) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDb(databaseUrl);
  const rollback = new Error("rollback_organisation_dashboard_test");
  try {
    await db.transaction(async (tx) => {
      await seed(tx as unknown as Database);
      await run(tx as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

const byStatus = <T extends { count: number }>(rows: T[], key: (row: T) => string) =>
  Object.fromEntries(rows.map((row) => [key(row), row.count]));

describe.skipIf(!HAS_DB)("organisation dashboard read models (integration)", () => {
  it("counts consignments for the organisation, and only a consignor's own for them", async () => {
    await inRollback(async (db) => {
      const reader = new DrizzleConsignmentStatusCountsReader(db);
      const lotKey = (row: { status: string; sold: boolean }) => `${row.status}:${row.sold}`;

      const all = await reader.count({ legalEntityId: ORG });
      expect(byStatus(all.submissions, (r) => r.status)).toEqual({
        under_review: 1,
        changes_requested: 1,
        approved: 1,
        submitted: 1,
        draft: 1,
      });
      expect(byStatus(all.lots, lotKey)).toEqual({
        "scheduled:false": 2,
        "active:false": 1,
        "ended:true": 3,
        "ended:false": 1,
        "cancelled:false": 1,
      });

      const own = await reader.count({
        legalEntityId: ORG,
        visibleTo: { scope: "own", userId: CONSIGNOR_A },
        lotsSentBy: CONSIGNOR_A,
      });
      expect(byStatus(own.submissions, (r) => r.status)).toEqual({
        under_review: 1,
        changes_requested: 1,
        draft: 1,
      });
      expect(byStatus(own.lots, lotKey)).toEqual({ "scheduled:false": 1, "ended:true": 1 });

      const attributed = await reader.count({
        legalEntityId: ORG,
        visibleTo: { scope: "attributed", userId: OWNER },
      });
      expect(byStatus(attributed.submissions, (r) => r.status)).not.toHaveProperty("submitted");
      // Members who follow consignments without sending them see every lot.
      expect(byStatus(attributed.lots, lotKey)).toEqual(byStatus(all.lots, lotKey));
    });
  });

  it("lists upcoming sales with works and estimates per currency, scoped like consignments", async () => {
    await inRollback(async (db) => {
      const reader = new DrizzleUpcomingSaleWorksReader(db);
      const rows = await reader.list({ legalEntityId: ORG }, NOW, 50);
      expect(rows).toEqual([
        {
          saleId: SALE_UPCOMING,
          title: "Modern British",
          startsAt: new Date("2026-11-20T10:00:00Z"),
          currency: "EUR",
          works: 1,
          estimatedWorks: 1,
          estimateLow: "2000",
          estimateHigh: "3000",
        },
        {
          saleId: SALE_UPCOMING,
          title: "Modern British",
          startsAt: new Date("2026-11-20T10:00:00Z"),
          currency: "GBP",
          works: 2,
          estimatedWorks: 1,
          estimateLow: "1000",
          estimateHigh: "1500",
        },
      ]);

      const own = await reader.list(
        {
          legalEntityId: ORG,
          visibleTo: { scope: "own", userId: CONSIGNOR_A },
          lotsSentBy: CONSIGNOR_A,
        },
        NOW,
        50,
      );
      expect(own.map((row) => [row.currency, row.works])).toEqual([["GBP", 1]]);

      expect(await reader.list({ legalEntityId: ORG }, new Date("2026-12-01"), 50)).toEqual([]);
    });
  });

  it("totals this year's sales per currency, leaving last year's out", async () => {
    await inRollback(async (db) => {
      const rows = await new DrizzleSoldWorksReader(db).soldBetween(
        ORG,
        new Date("2026-01-01T00:00:00Z"),
        new Date("2027-01-01T00:00:00Z"),
      );
      expect(rows.sort((a, b) => a.currency.localeCompare(b.currency))).toEqual([
        { currency: "EUR", count: 1, amount: "3000.00" },
        { currency: "GBP", count: 1, amount: "5000.00" },
      ]);
    });
  });

  it("lists payouts still to arrive with the lines they pay out", async () => {
    await inRollback(async (db) => {
      const due = await new DrizzlePayoutsDueReader(db).listDue(ORG);
      expect(
        due.map((row) => [row.periodEnd.toISOString(), row.lines.map((l) => l.amount)]).sort(),
      ).toEqual([
        ["2026-10-31T00:00:00.000Z", ["100.00"]],
        ["2026-11-03T00:00:00.000Z", ["900.00"]],
      ]);
    });
  });
});
