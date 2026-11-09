import type { CollectionVisitView } from "@auction/types";
import { describe, expect, it } from "vitest";
import { orderVisits, visitCard } from "./collect-visit.vm";

const NOW = new Date("2026-11-09T10:00:00.000Z");

function visit(overrides: Partial<CollectionVisitView> = {}): CollectionVisitView {
  return {
    id: "5d1b4c5e-7f0e-4c8e-9a54-2b7f3c1a9e01",
    reference: "COL-1042",
    status: "booked",
    start: "2026-11-12T14:00:00.000Z",
    end: "2026-11-12T14:30:00.000Z",
    version: 0,
    lots: [{ lotId: "l1", title: "Blue Study", lotNumber: 4, active: true, outcome: null }],
    collector: { kind: "self", name: "Ada Lovelace", email: null, company: null },
    authorisedAt: null,
    bookedByYou: true,
    bookedVia: "client",
    noticeDeadline: "2026-11-11T16:00:00.000Z",
    actions: ["change", "cancel"],
    handedOverAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

const ctx = { now: NOW, contactEmail: "info@thelax.art" };

describe("visitCard", () => {
  it("offers change, cancel and the calendar to a visit to come", () => {
    const card = visitCard(visit(), ctx);
    expect(card.live).toBe(true);
    expect(card.can).toEqual({ change: true, cancel: true, calendar: true });
    expect(card.deadline).toContain("Change or cancel online until");
    expect(card.idRule).toContain("Ada Lovelace");
  });

  it("names a third party and keeps the ID rule on them", () => {
    const card = visitCard(
      visit({
        collector: { kind: "third_party", name: "Sam Shipper", email: null, company: "Fast Ltd" },
      }),
      ctx,
    );
    expect(card.collector).toMatchObject({ name: "Sam Shipper", thirdParty: true });
    expect(card.collector.detail).toBe("Third party · Fast Ltd");
  });

  it("points to email and phone once the cut-off has passed", () => {
    const card = visitCard(visit({ actions: [], noticeDeadline: null }), ctx);
    expect(card.can.change).toBe(false);
    expect(card.afterCutoff).toContain("info@thelax.art");
  });

  it("offers a new time after a missed visit, for the lots left behind", () => {
    const card = visitCard(
      visit({
        status: "not_collected",
        start: "2026-11-05T14:00:00.000Z",
        end: "2026-11-05T14:30:00.000Z",
        actions: [],
      }),
      ctx,
    );
    expect(card.outcome?.tone).toBe("warning");
    expect(card.rebook?.href).toContain("lots=l1");
    expect(card.live).toBe(false);
  });

  it("never shows who in the organisation booked it", () => {
    const card = visitCard(visit({ bookedByYou: false }), ctx);
    expect(card.bookedByAnother).toBe(true);
  });
});

describe("orderVisits", () => {
  it("puts visits to come first, soonest first, and earlier ones newest first", () => {
    const soon = visit({ id: "a", start: "2026-11-12T14:00:00.000Z" });
    const later = visit({ id: "b", start: "2026-11-20T14:00:00.000Z" });
    const old = visit({ id: "c", status: "collected", start: "2026-10-01T14:00:00.000Z" });
    const older = visit({ id: "d", status: "cancelled", start: "2026-09-01T14:00:00.000Z" });
    const { upcoming, earlier } = orderVisits([later, old, soon, older], NOW);
    expect(upcoming.map((v) => v.id)).toEqual(["a", "b"]);
    expect(earlier.map((v) => v.id)).toEqual(["c", "d"]);
  });
});
