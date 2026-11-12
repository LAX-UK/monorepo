import {
  ArtworkOfferLock,
  ArtworkOfferedElsewhereError,
  type NewArtworkRegisterEntry,
} from "@auction/artwork-register-contracts";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { DrizzleArtworkRegisterRepository } from "./index.js";

const url = process.env.DATABASE_URL;
const db = url ? createDb(url) : (null as never);

const NOW = new Date("2026-11-03T09:00:00.000Z");
/** Later than NOW so the lock's history entries sort after the one written at creation. */
const LATER = new Date("2026-11-03T09:05:00.000Z");
const shop = { kind: "shop_artwork", id: "art-1" } as const;
const lot = { kind: "bid_lot", id: "lot-1" } as const;

function newEntry(overrides: Partial<NewArtworkRegisterEntry> = {}): NewArtworkRegisterEntry {
  return {
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
    ...overrides,
  };
}

describe.skipIf(!url)("one place at a time (Postgres)", { timeout: 30_000 }, () => {
  const repo = new DrizzleArtworkRegisterRepository(db);
  const lock = new ArtworkOfferLock(repo, () => LATER);

  beforeEach(async () => {
    // Not TRUNCATE ... CASCADE: Bid lots reference the register, and a cascade would wipe them too.
    await db.execute(
      sql`UPDATE lot SET artwork_register_id = NULL WHERE artwork_register_id IS NOT NULL`,
    );
    await db.execute(sql`TRUNCATE artwork_register_conflict, artwork_register_event`);
    await db.execute(sql`UPDATE artwork_register SET source_original_id = NULL`);
    await db.execute(sql`DELETE FROM artwork_register`);
    await db.execute(sql`DELETE FROM domain_events WHERE aggregate_type = 'artwork_register'`);
  });

  async function created() {
    const result = await repo.create(newEntry(), "zoho", NOW);
    if (!result.ok) throw new Error(result.reason);
    return result.entry;
  }

  it("moves a held original to lax.art on publish and records the move and its event", async () => {
    const entry = await created();
    const outcome = await lock.offer({ registerId: entry.id }, shop, "staff:u1");
    expect(outcome.status).toBe("moved");

    const after = await repo.findById(entry.id);
    expect(after?.offer).toEqual({ state: "lax_art", ref: shop });
    const events = await repo.listEvents(entry.id, 10);
    expect(events.map((e) => e.type)).toEqual(["created", "offer_moved"]);
    expect(events[1]?.actor).toBe("staff:u1");

    const published = await db.execute(
      sql`SELECT payload FROM domain_events
          WHERE aggregate_type = 'artwork_register' AND event_type = 'artwork_register.offer_changed'`,
    );
    expect(published.rows).toHaveLength(1);
    expect(published.rows[0]?.payload).toMatchObject({ fromState: "held", toState: "lax_art" });
  });

  it("refuses to offer an original that is offered elsewhere, and changes nothing", async () => {
    const entry = await created();
    await lock.offer({ zohoProductId: "5001" }, shop, "staff:u1");

    await expect(lock.offer({ registerId: entry.id }, lot, "staff:u2")).rejects.toThrow(
      "This artwork is live on lax.art. Take it off lax.art first, or use Offer at auction to move it.",
    );
    await expect(lock.assertCanOffer({ registerId: entry.id }, lot)).rejects.toBeInstanceOf(
      ArtworkOfferedElsewhereError,
    );
    expect((await repo.findById(entry.id))?.offer).toEqual({ state: "lax_art", ref: shop });
    expect(await repo.listEvents(entry.id, 10)).toHaveLength(2);
  });

  it("lets the artwork move to Bid once it is withdrawn from lax.art", async () => {
    const entry = await created();
    await lock.offer({ registerId: entry.id }, shop, "staff:u1");
    await lock.withdraw({ registerId: entry.id }, shop, "staff:u1");
    expect((await lock.offer({ registerId: entry.id }, lot, "staff:u1")).status).toBe("moved");
    expect((await repo.findById(entry.id))?.offer).toEqual({ state: "bid_sale", ref: lot });
  });

  it("does not withdraw an offer another place holds", async () => {
    const entry = await created();
    await lock.offer({ registerId: entry.id }, lot, "system");
    expect((await lock.withdraw({ registerId: entry.id }, shop, "system")).status).toBe(
      "unchanged",
    );
    expect((await repo.findById(entry.id))?.offer.state).toBe("bid_sale");
  });

  it("is terminal once sold: the sale keeps its reference and nothing can offer it again", async () => {
    const entry = await created();
    await lock.offer({ registerId: entry.id }, lot, "system");
    expect((await lock.markSold({ registerId: entry.id }, lot, "system")).status).toBe("moved");
    expect((await repo.findById(entry.id))?.offer).toEqual({ state: "sold", ref: lot });

    expect((await lock.markSold({ registerId: entry.id }, lot, "system")).status).toBe("unchanged");
    await expect(lock.offer({ registerId: entry.id }, shop, "staff:u1")).rejects.toThrow(
      "has been sold",
    );
  });

  it("commits or rolls back with the caller's transaction when built over it", async () => {
    const entry = await created();
    await expect(
      db.transaction(async (tx) => {
        const inTx = new ArtworkOfferLock(repo.withExecutor(tx as never), () => LATER);
        expect((await inTx.offer({ registerId: entry.id }, shop, "staff:u1")).status).toBe("moved");
        throw new Error("the product change failed");
      }),
    ).rejects.toThrow("the product change failed");
    expect((await repo.findById(entry.id))?.offer).toEqual({ state: "held", ref: null });
    expect(await repo.listEvents(entry.id, 10)).toHaveLength(1);

    await db.transaction(async (tx) => {
      const inTx = new ArtworkOfferLock(repo.withExecutor(tx as never), () => LATER);
      await inTx.offer({ registerId: entry.id }, shop, "staff:u1");
    });
    expect((await repo.findById(entry.id))?.offer.state).toBe("lax_art");
  });

  it("does nothing for an artwork with no register entry", async () => {
    expect(await lock.offer({ zohoProductId: "missing" }, shop, "staff:u1")).toEqual({
      status: "not_governed",
    });
    expect(await lock.offer(null, lot, "staff:u1")).toEqual({ status: "not_governed" });
    const rows = await db.execute(sql`SELECT count(*)::int AS n FROM artwork_register_event`);
    expect(rows.rows[0]?.n).toBe(0);
  });

  it("sells a withdrawn artwork on an ATG result, and raises one staff item if it was relisted", async () => {
    const entry = await created();
    await lock.offer({ registerId: entry.id }, lot, "system");
    await lock.withdraw({ registerId: entry.id }, lot, "system");
    expect((await lock.markSold({ registerId: entry.id }, lot, "system")).status).toBe("moved");
    expect((await lock.markSold({ registerId: entry.id }, lot, "system")).status).toBe("unchanged");

    const relisted = await repo.create(
      newEntry({ zohoProductId: "5002", stockCode: "LAX-ORI-PH-GAC-26-0002" }),
      "zoho",
      NOW,
    );
    if (!relisted.ok) throw new Error(relisted.reason);
    await lock.offer({ registerId: relisted.entry.id }, shop, "staff:u1");
    const outcome = await lock.markSold({ registerId: relisted.entry.id }, lot, "system");
    expect(outcome.status).toBe("skipped");
    const input = {
      registerId: relisted.entry.id,
      message: "Sold on ATG but now listed on lax.art",
      state: "lax_art" as const,
      lotId: lot.id,
      now: LATER,
    };
    expect(await repo.recordOfferConflict(input)).toBe(true);
    expect(await repo.recordOfferConflict(input)).toBe(false);
    const open = await repo.listOpenConflicts(10);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ field: "offerState", zohoValue: input.message });
    expect((await repo.findById(relisted.entry.id))?.offer.state).toBe("lax_art");
  });

  it("does not raise an ATG sold conflict again once staff have settled it, but does for a new situation", async () => {
    const entry = await created();
    const input = {
      registerId: entry.id,
      message: "Sold on ATG but now listed on lax.art",
      state: "lax_art" as const,
      lotId: lot.id,
      now: LATER,
    };
    expect(await repo.recordOfferConflict(input)).toBe(true);
    await db.execute(
      sql`UPDATE artwork_register_conflict SET status = 'resolved', resolution = 'kept_lax',
            resolved_by = 'staff:u1', resolved_at = now() WHERE register_id = ${entry.id}`,
    );
    expect(await repo.recordOfferConflict(input)).toBe(false);
    expect(await repo.listOpenConflicts(10)).toHaveLength(0);

    const other = { ...input, state: "private_sale" as const, message: "Sold on ATG elsewhere" };
    expect(await repo.recordOfferConflict(other)).toBe(true);
    expect(await repo.recordOfferConflict(input)).toBe(false);
    expect(await repo.listOpenConflicts(10)).toHaveLength(1);
  });
});
