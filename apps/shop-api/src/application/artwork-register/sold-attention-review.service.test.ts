import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { describe, expect, it, vi } from "vitest";
import type { SoldAttentionRecord } from "../ports/sold-attention.ports.js";
import { SoldAttentionReviewService } from "./sold-attention-review.service.js";

const NOW = new Date("2026-11-11T09:00:00.000Z");
const MARKED = new Date("2026-11-03T15:30:00.000Z");

const entry = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Blue Door",
  stockCode: "LAX-ORI-PH-GAC-26-0001",
} as ArtworkRegisterEntry;

const record = (over: Partial<SoldAttentionRecord> = {}): SoldAttentionRecord => ({
  id: "00000000-0000-4000-8000-0000000000a1",
  registerId: entry.id,
  zohoProductId: "z-1",
  zohoStatus: "Sold",
  place: "lax_art",
  placeRefId: "shop-1",
  markedAt: MARKED,
  raisedAt: NOW,
  ...over,
});

function setup(rows: { item: SoldAttentionRecord; entry: ArtworkRegisterEntry }[] = []) {
  const queue = {
    listOpen: vi.fn(async () => rows),
    override: vi.fn(async () => ({ ok: true as const, item: record() })),
  };
  const lots = { numbersFor: vi.fn(async () => new Map([["lot-9", 12]])) };
  return { queue, lots, service: new SoldAttentionReviewService({ queue, lots, now: () => NOW }) };
}

describe("SoldAttentionReviewService.list", () => {
  it("says what needs attention in the agreed words, in one date style", async () => {
    const { service } = setup([{ item: record(), entry }]);
    const { items } = await service.list();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      tone: "danger",
      title: "Zoho says Sold, but this artwork is still for sale",
      body:
        "Blue Door (LAX-ORI-PH-GAC-26-0001) was marked Sold in Zoho on 3 November 2026. " +
        "It is still on lax.art. New payments and acceptances are paused until you decide.",
      actions: [
        { kind: "unpublish_lax_art", label: "Unpublish from lax.art" },
        { kind: "open_in_zoho", label: "Open in Zoho" },
        { kind: "not_sold", label: "It is not sold" },
      ],
    });
  });

  it("names the lot for a Bid sale, and says Reserved when Zoho does", async () => {
    const { service, lots } = setup([
      { item: record({ zohoStatus: "Reserved", place: "bid_sale", placeRefId: "lot-9" }), entry },
    ]);
    const { items } = await service.list();
    expect(lots.numbersFor).toHaveBeenCalledWith(["lot-9"]);
    expect(items[0]?.title).toBe("Zoho says Reserved, but this artwork is still for sale");
    expect(items[0]?.body).toContain("It is still in a LAX Bid sale, lot 12.");
    expect(items[0]?.actions[0]?.label).toBe("Withdraw the lot");
  });

  it("has the empty state when nothing needs attention", async () => {
    const { service, lots } = setup([]);
    expect(await service.list()).toEqual({
      items: [],
      emptyMessage: "Nothing needs attention. Zoho and LAX agree.",
    });
    expect(lots.numbersFor).not.toHaveBeenCalled();
  });
});

describe("SoldAttentionReviewService.override", () => {
  const input = (reason: string) => ({
    attentionId: record().id,
    body: { reason },
    actorSubjectId: "staff-7",
  });

  it("clears the item under the staff member's id, keeping the trimmed reason", async () => {
    const { service, queue } = setup();
    const outcome = await service.override(input("  Zoho was edited by mistake  "));
    expect(outcome).toEqual({
      kind: "overridden",
      result: { id: record().id, registerId: entry.id },
    });
    expect(queue.override).toHaveBeenCalledWith({
      id: record().id,
      reason: "Zoho was edited by mistake",
      actor: "staff:staff-7",
      now: NOW,
    });
  });

  it("refuses without a reason and changes nothing", async () => {
    const { service, queue } = setup();
    expect(await service.override(input("   "))).toEqual({ kind: "reason_required" });
    expect(queue.override).not.toHaveBeenCalled();
  });

  it("refuses a reason that is too long", async () => {
    const { service, queue } = setup();
    expect(await service.override(input("x".repeat(501)))).toEqual({ kind: "reason_too_long" });
    expect(queue.override).not.toHaveBeenCalled();
  });

  it.each(["not_found", "not_open"] as const)("passes %s on", async (reason) => {
    const { service, queue } = setup();
    queue.override.mockResolvedValueOnce({ ok: false, reason } as never);
    expect(await service.override(input("Not sold"))).toEqual({ kind: reason });
  });
});
