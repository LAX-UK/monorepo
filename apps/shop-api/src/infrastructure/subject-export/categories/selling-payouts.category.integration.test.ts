import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { shopOriginalSale, shopParty, shopPayoutLedger } from "@auction/db/schema";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublishedArtworkImportWriter } from "../../../test-support/shop-fixtures.js";
import { SellingPayoutsCategory } from "./selling-payouts.category.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;
const ORIGINS = { shop: "https://shop.example", art: "https://art.example" };

describe.skipIf(!ownerUrl || !shopUrl)("selling payouts export category", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl || !shopUrl) throw new Error("Integration test database URLs are required");
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    shopPool = new pg.Pool({ connectionString: shopUrl });
    await applyApplicationRoleGrants(ownerUrl);
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  async function setup() {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const db = createDbFromPool(shopPool);
    const party = async (name: string, subject: string | null) => {
      const [row] = await db
        .insert(shopParty)
        .values({ displayName: name, identitySubjectId: subject })
        .returning({ id: shopParty.id });
      return row?.id as string;
    };
    const seller = await party(`Seller ${id}`, `payout-seller-${id}`);
    const otherSeller = await party(`Other seller ${id}`, `payout-other-${id}`);
    const buyer = await party(`Buyer Name ${id}`, `payout-buyer-${id}`);
    let n = 0;
    const ledger = async (owner: string) => {
      n += 1;
      const imported = await createPublishedArtworkImportWriter(db).importArtwork({
        importKey: `integration:payouts:${id}:${n}`,
        slug: `integration-payouts-work-${id}-${n}`,
        title: "Payout work",
        description: null,
        primaryImageUrl: null,
        artistSlug: `integration-payouts-artist-${id}`,
        artistDisplayName: "Payout Artist",
        eligibleForEditionAllocation: false,
        printPricePence: null,
      });
      const [sale] = await db
        .insert(shopOriginalSale)
        .values({
          artworkId: imported.artworkId,
          buyerPartyId: buyer,
          status: "assigned",
          salePricePence: 100_000,
          recordedBySubjectId: "staff-1",
        })
        .returning({ id: shopOriginalSale.id });
      await db.insert(shopPayoutLedger).values({
        originalSaleId: sale?.id as string,
        source: "original_sale",
        ownerPartyId: owner,
        grossPence: 100_000,
        deductionsPence: 25_000,
        netPence: 75_000,
        payoutDueAt: new Date(),
        status: "due",
        blockedReason: "internal hold note",
        paidBySubjectId: "staff-2",
      });
    };
    return { db, id, seller, otherSeller, ledger, sellerSubject: `payout-seller-${id}` };
  }

  it("returns only the person's own payouts, without the buyer or staff fields", async () => {
    const { db, id, seller, otherSeller, ledger, sellerSubject } = await setup();
    await ledger(seller);
    await ledger(otherSeller);
    const category = new SellingPayoutsCategory({ db, files: {} as never, origins: ORIGINS });

    expect(await category.count(sellerSubject)).toBe(1);
    const page = await category.readPage(sellerSubject, null);
    expect(page.records).toHaveLength(1);
    expect(page.records[0]).toMatchObject({
      source: "original_sale",
      gross: { minor: 100_000, currency: "GBP" },
      fees: { minor: 25_000, currency: "GBP" },
      net: { minor: 75_000, currency: "GBP" },
      status: "due",
    });
    const text = JSON.stringify(page.records);
    for (const hidden of [`Buyer Name ${id}`, "staff-1", "staff-2", "internal hold note"]) {
      expect(text).not.toContain(hidden);
    }
  });

  it("is empty for a person who never sold", async () => {
    const { db } = await setup();
    const category = new SellingPayoutsCategory({ db, files: {} as never, origins: ORIGINS });
    expect(await category.count("never-sold")).toBe(0);
    expect(await category.readPage("never-sold", null)).toEqual({ records: [], nextCursor: null });
  });
});
