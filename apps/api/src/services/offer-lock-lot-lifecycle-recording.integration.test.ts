import { createDb } from "@auction/db";
import { artworkRegister, legalEntity, lot } from "@auction/db/schema";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleLotLifecycleSnapshotRepository,
} from "@auction/persistence/repositories";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPlatformCore } from "../container/create-platform-core.js";
import { seedIdentityUserFixtures } from "../testing/identity-user-fixtures.js";

const url = process.env.DATABASE_URL;
const db = url ? createDb(url) : (null as never);

const userId = "offer-lock-publish-user";
const entityId = "aaaaaaaa-0000-4000-8000-0000000000a1";
const lotId = "aaaaaaaa-0000-4000-8000-0000000000b1";
const ZOHO_PRODUCT_ID = "offer-lock-publish-1";
const NOW = new Date("2026-11-03T09:00:00.000Z");

const lotRow = {
  id: lotId,
  status: "draft" as const,
  saleId: null,
  sellerLegalEntityId: entityId,
};

describe.skipIf(!url)("publishing a lot moves the register with the publish (Postgres)", () => {
  const registerRepo = new DrizzleArtworkRegisterRepository(db);
  const recording = createPlatformCore(
    db,
    { lotLifecycleSnapshotRepository: new DrizzleLotLifecycleSnapshotRepository(db) },
    { DOMAIN_EVENT_PUBLISH_VALIDATE: "off" },
  ).lotLifecycleRecording;
  let registerId = "";

  async function offerStateOf() {
    const [row] = await db
      .select({ state: artworkRegister.offerState, refId: artworkRegister.offerRefId })
      .from(artworkRegister)
      .where(eq(artworkRegister.id, registerId));
    return row;
  }

  async function publishEvents() {
    const result = await db.execute(
      sql`SELECT 1 FROM domain_events WHERE aggregate_type = 'lot' AND aggregate_id = ${lotId}
          AND event_type = 'lot.published'`,
    );
    return result.rows.length;
  }

  async function reset() {
    await db.execute(sql`DELETE FROM domain_events WHERE aggregate_id = ${lotId}`);
    await db.execute(sql`DELETE FROM lot_lifecycle_snapshot WHERE lot_id = ${lotId}`);
    await db.execute(sql`DELETE FROM lot WHERE id = ${lotId}`);
    // The history is append-only, so it is cleared the way the register's own tests clear it.
    await db.execute(sql`TRUNCATE artwork_register_conflict, artwork_register_event`);
    await db.execute(
      sql`DELETE FROM domain_events WHERE aggregate_type = 'artwork_register' AND aggregate_id IN (SELECT id::text FROM artwork_register WHERE zoho_product_id = ${ZOHO_PRODUCT_ID})`,
    );
    await db.execute(sql`DELETE FROM artwork_register WHERE zoho_product_id = ${ZOHO_PRODUCT_ID}`);
  }

  async function removeFixtures() {
    await reset();
    await db.execute(sql`DELETE FROM legal_entity WHERE id = ${entityId}`);
    await db.execute(sql`DELETE FROM public."user" WHERE id = ${userId}`);
  }

  beforeAll(async () => {
    await removeFixtures();
    const at = new Date();
    await seedIdentityUserFixtures(db, [
      { id: userId, name: "Staff", email: "offer-lock-publish@integration.test" },
    ]);
    await db.insert(legalEntity).values({
      id: entityId,
      displayName: "Gallery",
      kind: "organisation",
      subkind: "gallery",
      createdByUserId: userId,
      status: "approved",
      createdAt: at,
      updatedAt: at,
    });
  });

  afterAll(removeFixtures);

  async function seedLinkedDraftLot() {
    const created = await registerRepo.create(
      {
        zohoProductId: ZOHO_PRODUCT_ID,
        stockCode: "LAX-ORI-PH-GAC-26-9001",
        kind: "original",
        sourceOriginalId: null,
        title: "Harbour at dusk",
        artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
        medium: null,
        dimensions: null,
        year: 2024,
        imageRefs: [],
        catalogueStatus: "Available",
      },
      "zoho",
      NOW,
    );
    if (!created.ok) throw new Error(created.reason);
    registerId = created.entry.id;
    await db.insert(lot).values({
      id: lotId,
      sellerLegalEntityId: entityId,
      artworkRegisterId: registerId,
      title: "Harbour at dusk",
      images: [],
      auctionType: "english",
      startingPrice: "100",
      currentPrice: "100",
      buyerPremiumRate: "0.25",
      minBidIncrement: "10",
      startTime: new Date("2026-12-01T12:00:00.000Z"),
      endTime: new Date("2026-12-02T12:00:00.000Z"),
      status: "draft",
    });
  }

  it("leaves the artwork held when the publish rolls back after the offer", async () => {
    await reset();
    await seedLinkedDraftLot();

    await expect(
      db.transaction(async (tx) => {
        await recording.recordPublished(tx, lotRow, userId);
        // The offer is recorded inside the transaction, then something later in the publish fails.
        const inside = await tx
          .select({ state: artworkRegister.offerState })
          .from(artworkRegister)
          .where(eq(artworkRegister.id, registerId));
        expect(inside[0]?.state).toBe("bid_sale");
        throw new Error("publish_failed_after_offer");
      }),
    ).rejects.toThrow("publish_failed_after_offer");

    expect(await offerStateOf()).toEqual({ state: "held", refId: null });
    expect(await publishEvents()).toBe(0);
  });

  it("records the artwork as in a Bid sale when the publish commits", async () => {
    await reset();
    await seedLinkedDraftLot();

    await db.transaction((tx) => recording.recordPublished(tx, lotRow, userId));

    expect(await offerStateOf()).toEqual({ state: "bid_sale", refId: lotId });
    expect(await publishEvents()).toBe(1);
  });
});
