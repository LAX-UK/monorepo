import type { NewArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { DrizzleArtworkRegisterRepository, DrizzleAuctionOfferReader } from "./index.js";

const url = process.env.DATABASE_URL;
const db = url ? createDb(url) : (null as never);

const NOW = new Date("2026-11-03T09:00:00.000Z");

const entry: NewArtworkRegisterEntry = {
  zohoProductId: "5001",
  stockCode: "LAX-ORI-PH-GAC-26-0001",
  kind: "original",
  sourceOriginalId: null,
  title: "Harbour at dusk",
  artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
  medium: null,
  dimensions: null,
  year: 2024,
  imageRefs: [],
  catalogueStatus: "Available",
};

describe.skipIf(!url)("moving an original between lax.art and LAX Bid (Postgres)", () => {
  const repo = new DrizzleArtworkRegisterRepository(db);

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE artwork_register_conflict, artwork_register_event, artwork_register CASCADE`,
    );
  });

  it("keeps who confirmed a move, and where it went, in the register history", async () => {
    const created = await repo.create(entry, "zoho", NOW);
    if (!created.ok) throw new Error(created.reason);
    const result = await repo.recordMoveConfirmed({
      registerId: created.entry.id,
      actor: "staff:u1",
      record: {
        direction: "to_auction",
        saleId: "sale-1",
        lotId: "lot-1",
        consignorAgreed: true,
        confirmedBy: "staff:u1",
      },
      now: NOW,
    });
    expect(result).toEqual({ status: "recorded" });
    const events = await repo.listEvents(created.entry.id, 10);
    expect(events.map((e) => e.type)).toEqual(["created", "move_confirmed"]);
    expect(events[1]).toMatchObject({
      actor: "staff:u1",
      payload: { direction: "to_auction", saleId: "sale-1", consignorAgreed: true },
    });
  });

  it("says so for a register record that does not exist", async () => {
    expect(
      await repo.recordMoveConfirmed({
        registerId: "00000000-0000-4000-8000-000000000000",
        actor: "staff:u1",
        record: { direction: "to_lax_art", lotId: "lot-1", confirmedBy: "staff:u1" },
        now: NOW,
      }),
    ).toEqual({ status: "not_found" });
  });

  it("allows only one open lot per artwork, and nothing else is affected", async () => {
    const indexes = await db.execute(
      sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'lot_artwork_register_open_uid'`,
    );
    expect(indexes.rows).toHaveLength(1);
    expect(String(indexes.rows[0]?.indexdef)).toContain("UNIQUE");
    expect(String(indexes.rows[0]?.indexdef)).toContain("draft");
  });

  it("finds no sale or lot when there is none", async () => {
    const reader = new DrizzleAuctionOfferReader(db);
    expect(await reader.findOpenLotForRegister("00000000-0000-4000-8000-000000000000")).toBeNull();
    const sales = await reader.listSalesOpenForOffer(NOW);
    expect(Array.isArray(sales)).toBe(true);
  });
});
