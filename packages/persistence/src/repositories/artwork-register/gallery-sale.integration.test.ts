import type { NewArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleArtworkRegisterRepository, DrizzleSoldAttentionStore } from "./index.js";

const url = process.env.DATABASE_URL;
const db = url ? createDb(url) : (null as never);

const T0 = new Date("2026-11-14T09:00:00.000Z");
const T1 = new Date("2026-11-15T10:00:00.000Z");
const T2 = new Date("2026-11-15T11:00:00.000Z");

function newEntry(n: number, catalogueStatus: string): NewArtworkRegisterEntry {
  return {
    zohoProductId: `gs-${n}`,
    stockCode: `LAX-ORI-PH-GAC-26-${String(n).padStart(4, "0")}`,
    kind: "original",
    sourceOriginalId: null,
    title: `Work ${n}`,
    artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
    medium: null,
    dimensions: null,
    year: null,
    imageRefs: [],
    catalogueStatus,
  };
}

describe.skipIf(!url)("gallery sales in the register (Postgres)", { timeout: 30_000 }, () => {
  const register = new DrizzleArtworkRegisterRepository(db);
  const attention = new DrizzleSoldAttentionStore(db);

  afterAll(async () => {
    await db.execute(sql`DELETE FROM artwork_register_sold_attention`);
  });

  beforeEach(async () => {
    await db.execute(
      sql`UPDATE lot SET artwork_register_id = NULL WHERE artwork_register_id IS NOT NULL`,
    );
    await db.execute(
      sql`TRUNCATE artwork_register_sold_attention, artwork_register_conflict, artwork_register_event`,
    );
    await db.execute(sql`UPDATE artwork_register SET source_original_id = NULL`);
    await db.execute(sql`DELETE FROM artwork_register`);
  });

  async function entry(n: number, status: string) {
    const result = await register.create(newEntry(n, status), "zoho", T0);
    if (!result.ok) throw new Error(result.reason);
    return result.entry;
  }

  async function onLaxArt(n: number, status: string) {
    const e = await entry(n, status);
    const moved = await register.moveOffer({
      registerId: e.id,
      expectedVersion: e.version,
      to: "lax_art",
      ref: { kind: "shop_artwork", id: `shop-${n}` },
      actor: "staff:s1",
      now: T0,
    });
    if (!moved.ok) throw new Error(moved.reason);
    return moved.entry;
  }

  async function offerChanges(registerId: string) {
    const rows = await db.execute<{ to_state: string }>(
      sql`SELECT payload->>'toState' AS to_state FROM domain_events
          WHERE aggregate_id = ${registerId} AND event_type = 'artwork_register.offer_changed'
          ORDER BY id`,
    );
    return rows.rows.map((row) => row.to_state);
  }

  it("records the sale from lax.art once, with history and one offer_changed event", async () => {
    const e = await onLaxArt(1, "Sold");
    const first = await register.recordGallerySale({ registerId: e.id, now: T1 });
    expect(first).toMatchObject({ status: "recorded", from: "lax_art", laxArtListingId: "shop-1" });
    const again = await register.recordGallerySale({ registerId: e.id, now: T2 });
    expect(again.status).toBe("unchanged");

    const after = await register.findById(e.id);
    expect(after?.offer).toEqual({ state: "sold", ref: { kind: "gallery_sale", id: "gs-1" } });
    const events = await register.listEvents(e.id, 20);
    expect(events.filter((ev) => ev.type === "gallery_sale_recorded")).toHaveLength(1);
    expect(events.find((ev) => ev.type === "gallery_sale_recorded")?.actor).toBe("zoho");
    expect(await offerChanges(e.id)).toEqual(["lax_art", "sold"]);
  });

  it("does nothing while Zoho does not say Sold", async () => {
    const e = await onLaxArt(2, "Available");
    expect((await register.recordGallerySale({ registerId: e.id, now: T1 })).status).toBe(
      "unchanged",
    );
    expect((await register.findById(e.id))?.offer.state).toBe("lax_art");
  });

  it("lists the unrecorded sales for the nightly check, and not the recorded ones", async () => {
    const held = await entry(3, "Sold");
    const listed = await onLaxArt(4, "sold");
    await entry(5, "Available");
    const ids = await register.listGallerySaleCandidates(10);
    expect(new Set(ids)).toEqual(new Set([held.id, listed.id]));
    await register.recordGallerySale({ registerId: held.id, now: T1 });
    expect(await register.listGallerySaleCandidates(10)).toEqual([listed.id]);
  });

  it("refuses Reopen while Zoho still says Sold, and reopens to held once it does not", async () => {
    const e = await entry(6, "Sold");
    await register.recordGallerySale({ registerId: e.id, now: T1 });
    expect(
      await register.reopenGallerySale({
        registerId: e.id,
        reason: "Typed into the wrong record",
        actor: "staff:admin",
        now: T2,
      }),
    ).toEqual({ ok: false, refusal: "zoho_still_sold" });

    await db.execute(
      sql`UPDATE artwork_register SET catalogue_status = 'Available' WHERE id = ${e.id}`,
    );
    const reopened = await register.reopenGallerySale({
      registerId: e.id,
      reason: "  Typed into the wrong record ",
      actor: "staff:admin",
      now: T2,
    });
    expect(reopened).toMatchObject({ ok: true, reason: "Typed into the wrong record" });
    expect((await register.findById(e.id))?.offer).toEqual({ state: "held", ref: null });
    const event = (await register.listEvents(e.id, 20)).find(
      (ev) => ev.type === "gallery_sale_reopened",
    );
    expect(event).toMatchObject({
      actor: "staff:admin",
      payload: { reason: "Typed into the wrong record" },
    });
    expect(await offerChanges(e.id)).toEqual(["sold", "held"]);
  });

  it("refuses to reopen a sale made through LAX", async () => {
    const e = await onLaxArt(7, "Available");
    const sold = await register.moveOffer({
      registerId: e.id,
      expectedVersion: e.version,
      to: "sold",
      ref: { kind: "shop_artwork", id: "shop-7" },
      actor: "system",
      now: T1,
    });
    expect(sold.ok).toBe(true);
    expect(
      await register.reopenGallerySale({
        registerId: e.id,
        reason: "Mistake",
        actor: "staff:admin",
        now: T2,
      }),
    ).toEqual({ ok: false, refusal: "not_a_gallery_sale" });
  });

  it("keeps payments held after Dealt with while the gallery sale stands; only Reopen lifts it", async () => {
    const e = await onLaxArt(8, "Sold");
    await attention.raise({
      registerId: e.id,
      zohoProductId: e.zohoProductId,
      zohoStatus: "Sold",
      place: "lax_art",
      placeRefId: "shop-8",
      markedAt: T0,
      now: T1,
    });
    const item = await attention.findLive(e.id);
    if (!item) throw new Error("no item");
    expect(await attention.markDealtWith({ id: item.id, actor: "staff:s1", now: T1 })).toEqual({
      ok: false,
      reason: "not_sold_in_gallery",
    });

    await register.recordGallerySale({ registerId: e.id, now: T1 });
    expect(await attention.isPaused({ registerId: e.id })).toBe(true);
    const closed = await attention.markDealtWith({ id: item.id, actor: "staff:s1", now: T2 });
    expect(closed).toMatchObject({
      ok: true,
      item: { status: "resolved", resolution: "staff_resolved", resolvedBy: "staff:s1" },
    });
    // The item is closed, but Zoho says Sold: no lax.art money path may complete for the work.
    expect(await attention.isPaused({ registerId: e.id })).toBe(true);
    expect(await attention.isPaused({ zohoProductId: e.zohoProductId })).toBe(true);
    expect(await attention.markDealtWith({ id: item.id, actor: "staff:s1", now: T2 })).toEqual({
      ok: false,
      reason: "not_open",
    });
  });

  it("pauses money for a gallery sale with no item, until an Administrator reopens it", async () => {
    const e = await entry(9, "Sold");
    await register.recordGallerySale({ registerId: e.id, now: T1 });
    expect(await attention.isPaused({ registerId: e.id })).toBe(true);
    await db.execute(
      sql`UPDATE artwork_register SET catalogue_status = 'Available' WHERE id = ${e.id}`,
    );
    const reopened = await register.reopenGallerySale({
      registerId: e.id,
      reason: "Typed into the wrong record",
      actor: "staff:admin",
      now: T2,
    });
    expect(reopened.ok).toBe(true);
    expect(await attention.isPaused({ registerId: e.id })).toBe(false);
  });

  it("does not pause money for a work sold through LAX", async () => {
    const e = await onLaxArt(10, "Available");
    await register.moveOffer({
      registerId: e.id,
      expectedVersion: e.version,
      to: "sold",
      ref: { kind: "shop_artwork", id: "shop-10" },
      actor: "system",
      now: T1,
    });
    expect(await attention.isPaused({ registerId: e.id })).toBe(false);
  });

  it("an earlier It is not sold does not survive Zoho's Sold: the sale reraises the item and money is paused", async () => {
    const e = await onLaxArt(11, "Sold");
    await attention.raise({
      registerId: e.id,
      zohoProductId: e.zohoProductId,
      zohoStatus: "Sold",
      place: "lax_art",
      placeRefId: "shop-11",
      markedAt: T0,
      now: T0,
    });
    const raised = await attention.findLive(e.id);
    if (!raised) throw new Error("no item");
    const overridden = await attention.override({
      id: raised.id,
      reason: "Checked with the gallery: not sold",
      actor: "staff:s1",
      now: T0,
    });
    expect(overridden.ok).toBe(true);
    expect(await attention.isPaused({ registerId: e.id })).toBe(false);

    const recorded = await register.recordGallerySale({ registerId: e.id, now: T1 });
    expect(recorded.status).toBe("recorded");
    expect(await attention.isPaused({ registerId: e.id })).toBe(true);
    expect(await attention.isPaused({ zohoProductId: e.zohoProductId })).toBe(true);

    const live = await attention.findLive(e.id);
    expect(live).toMatchObject({ status: "open", zohoStatus: "Sold", place: "lax_art" });
    expect(live?.placeRefId).toBe("shop-11");
    expect(live?.id).not.toBe(raised.id);
    const old = await db.execute<{ status: string; resolution: string }>(
      sql`SELECT status, resolution FROM artwork_register_sold_attention WHERE id = ${raised.id}`,
    );
    expect(old.rows[0]).toEqual({ status: "resolved", resolution: "replaced" });
    const types = (await register.listEvents(e.id, 50)).map((ev) => ev.type);
    expect(types).toEqual(
      expect.arrayContaining([
        "sold_while_live_overridden",
        "gallery_sale_recorded",
        "sold_while_live_resolved",
        "sold_while_live_raised",
      ]),
    );

    // Staff then close the fresh item; money stays paused while the gallery sale stands.
    if (!live) throw new Error("no fresh item");
    expect((await attention.markDealtWith({ id: live.id, actor: "staff:s1", now: T2 })).ok).toBe(
      true,
    );
    expect(await attention.isPaused({ registerId: e.id })).toBe(true);
  });

  it("raises no item when the sale is recorded from held (nothing was on lax.art)", async () => {
    const e = await entry(12, "Sold");
    await register.recordGallerySale({ registerId: e.id, now: T1 });
    expect(await attention.findLive(e.id)).toBeNull();
  });
});
