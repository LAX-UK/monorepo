import { MAX_LOTS_PER_COLLECTION } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { collectSelection, collectionBadge } from "./purchase-collection";

const NOW = new Date("2026-11-15T10:00:00Z");
const notice = (state: "upcoming" | "soon" | "overdue") => ({ day: "Wed 9 Dec", state });

describe("collectionBadge", () => {
  it("says Booked with the visit's day, ahead of any notice", () => {
    const badge = collectionBadge({
      collectBy: notice("soon"),
      bookedStart: "2026-11-18T10:00:00Z",
      now: NOW,
    });
    expect(badge).toMatchObject({
      state: "booked",
      tone: "info",
      label: "Booked Wed 18 Nov",
      title: "Collection booked for Wed 18 Nov.",
    });
  });

  it("says Collect by <day> while upcoming, warning when soon", () => {
    expect(
      collectionBadge({ collectBy: notice("upcoming"), bookedStart: null, now: NOW }),
    ).toMatchObject({
      label: "Collect by Wed 9 Dec",
      tone: "neutral",
      title: "Please collect by Wed 9 Dec.",
    });
    expect(
      collectionBadge({ collectBy: notice("soon"), bookedStart: null, now: NOW }),
    ).toMatchObject({
      label: "Collect by Wed 9 Dec",
      tone: "warning",
    });
  });

  it("says Overdue since <day> once the day has passed, keeping the day on screen", () => {
    expect(
      collectionBadge({ collectBy: notice("overdue"), bookedStart: null, now: NOW }),
    ).toMatchObject({
      label: "Overdue since Wed 9 Dec",
      tone: "danger",
      title: "Collection overdue since Wed 9 Dec. Storage charges may apply.",
    });
  });

  it("wears the storage badge when the place's terms priced the lot", () => {
    const charging = collectionBadge({
      collectBy: {
        day: "Mon 16 Nov",
        state: "overdue",
        storage: { badge: "Collect by Mon 16 Nov · Storage £9.00 so far", state: "charging" },
      },
      bookedStart: null,
      now: NOW,
    });
    expect(charging).toMatchObject({
      state: "overdue",
      tone: "danger",
      label: "Collect by Mon 16 Nov · Storage £9.00 so far",
      title: "Collect by Mon 16 Nov · Storage £9.00 so far.",
    });
    const upcoming = collectionBadge({
      collectBy: {
        day: "Mon 16 Nov",
        state: "upcoming",
        storage: { badge: "Collect by Mon 16 Nov", state: "upcoming" },
      },
      bookedStart: null,
      now: NOW,
    });
    expect(upcoming).toMatchObject({ tone: "neutral", label: "Collect by Mon 16 Nov" });
  });

  it("has no badge when nothing waits and nothing is booked, or the start is unreadable", () => {
    expect(collectionBadge({ collectBy: null, bookedStart: null, now: NOW })).toBeNull();
    expect(collectionBadge({ collectBy: null, bookedStart: "nope", now: NOW })).toBeNull();
  });
});

describe("collectSelection", () => {
  // Each name stands for its own venue unless a test says otherwise.
  const at = (
    lotId: string,
    placeName: string | null,
    placeId: string | null = `v-${placeName}`,
  ) => ({
    lotId,
    collectBy: placeName ? { placeId, placeName } : null,
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

  it("tells apart two venues that share a name, as the server does", () => {
    const a = at("a", "LAX Gallery", "venue-1");
    const b = at("b", "LAX Gallery", "venue-2");
    const c = at("c", "LAX Gallery", "venue-1");
    expect(collectSelection([a, b], new Set(["a", "b"]))).toEqual({
      kind: "mixed_places",
      places: ["LAX Gallery"],
    });
    expect(collectSelection([a, c], new Set(["a", "c"]))).toMatchObject({
      kind: "ready",
      place: "LAX Gallery",
    });
  });

  it("falls back to the name when the API has not sent the venue id yet", () => {
    const a = at("a", "LAX Marylebone", null);
    const b = at("b", "LAX Marylebone", null);
    const c = at("c", "Other", null);
    expect(collectSelection([a, b], new Set(["a", "b"]))).toMatchObject({ kind: "ready" });
    expect(collectSelection([a, c], new Set(["a", "c"]))).toEqual({
      kind: "mixed_places",
      places: ["LAX Marylebone", "Other"],
    });
  });

  it("holds as many lots as the server's rule allows", () => {
    const cards = Array.from({ length: MAX_LOTS_PER_COLLECTION }, (_, i) => at(`l${i}`, "P"));
    expect(collectSelection(cards, new Set(cards.map((c) => c.lotId))).kind).toBe("ready");
  });
});
