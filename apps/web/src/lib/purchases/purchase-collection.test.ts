import { describe, expect, it } from "vitest";
import { collectSelection, collectionBadge } from "./purchase-collection";

const NOW = new Date("2026-11-15T10:00:00Z");
const notice = (state: "upcoming" | "soon" | "overdue") => ({
  day: "Wed 9 Dec",
  title: "Please collect by Wed 9 Dec",
  state,
});

describe("collectionBadge", () => {
  it("says Booked with the visit's day, ahead of any notice", () => {
    const badge = collectionBadge({
      collectBy: notice("soon"),
      bookedStart: "2026-11-18T10:00:00Z",
      now: NOW,
    });
    expect(badge).toMatchObject({ state: "booked", tone: "info", label: "Booked Wed 18 Nov" });
  });

  it("says Collect by <day> while upcoming, warning when soon", () => {
    expect(
      collectionBadge({ collectBy: notice("upcoming"), bookedStart: null, now: NOW }),
    ).toMatchObject({
      label: "Collect by Wed 9 Dec",
      tone: "neutral",
    });
    expect(
      collectionBadge({ collectBy: notice("soon"), bookedStart: null, now: NOW }),
    ).toMatchObject({
      label: "Collect by Wed 9 Dec",
      tone: "warning",
    });
  });

  it("says Overdue once the day has passed and keeps the day in the title", () => {
    expect(
      collectionBadge({ collectBy: notice("overdue"), bookedStart: null, now: NOW }),
    ).toMatchObject({
      label: "Overdue",
      tone: "danger",
      title: "Please collect by Wed 9 Dec",
    });
  });

  it("has no badge when nothing waits and nothing is booked, or the start is unreadable", () => {
    expect(collectionBadge({ collectBy: null, bookedStart: null, now: NOW })).toBeNull();
    expect(collectionBadge({ collectBy: null, bookedStart: "nope", now: NOW })).toBeNull();
  });
});

describe("collectSelection", () => {
  const at = (lotId: string, placeName: string | null) => ({
    lotId,
    collectBy: placeName ? { placeName } : null,
  });

  it("is none with nothing picked, or only lots that are not awaiting collection", () => {
    const cards = [at("a", "LAX Marylebone"), at("b", null)];
    expect(collectSelection(cards, new Set())).toEqual({ kind: "none" });
    expect(collectSelection(cards, new Set(["b"]))).toEqual({ kind: "none" });
  });

  it("hands lots at one place to the booking page as one visit", () => {
    const cards = [at("a", "LAX Marylebone"), at("b", "LAX Marylebone"), at("c", "Other")];
    expect(collectSelection(cards, new Set(["a", "b"]))).toEqual({
      kind: "ready",
      lotIds: ["a", "b"],
      place: "LAX Marylebone",
      href: "/purchases/collect?lots=a,b",
    });
  });

  it("refuses lots from different places", () => {
    const cards = [at("a", "LAX Marylebone"), at("c", "Other")];
    expect(collectSelection(cards, new Set(["a", "c"]))).toEqual({
      kind: "mixed_places",
      places: ["LAX Marylebone", "Other"],
    });
  });

  it("refuses more than 20 lots", () => {
    const cards = Array.from({ length: 21 }, (_, i) => at(`l${i}`, "P"));
    expect(collectSelection(cards, new Set(cards.map((c) => c.lotId)))).toEqual({
      kind: "too_many",
      count: 21,
    });
  });
});
