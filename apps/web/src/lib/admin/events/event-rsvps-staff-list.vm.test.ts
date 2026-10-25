import type { OnsiteEventListItem } from "@auction/types";
import { describe, expect, it } from "vitest";
import { queryEventRsvps } from "./event-rsvps-staff-list.vm";

const event = (over: Partial<OnsiteEventListItem>): OnsiteEventListItem => ({
  slug: "gala",
  title: "Autumn gala",
  startsAt: "2026-11-01T18:00:00.000Z",
  rsvpCloseAt: null,
  status: "published",
  rsvpCount: 10,
  saleId: null,
  ...over,
});

const events = [
  event({ slug: "a", title: "Autumn gala", startsAt: "2026-11-01T18:00:00.000Z" }),
  event({ slug: "b", title: "Book launch", startsAt: "2026-12-01T18:00:00.000Z", rsvpCount: 3 }),
  event({ slug: "c", title: "Collectors' evening", startsAt: null, status: "draft" }),
];

describe("queryEventRsvps", () => {
  it("puts the latest start first and undated events last by default", () => {
    const result = queryEventRsvps(events, {});
    expect(result.rows.map((row) => row.slug)).toEqual(["b", "a", "c"]);
    expect(result.sort).toEqual({ columnId: "starts", direction: "desc" });
  });

  it("keeps undated events last when sorting oldest first", () => {
    const result = queryEventRsvps(events, { sort: "starts_asc" });
    expect(result.rows.map((row) => row.slug)).toEqual(["a", "b", "c"]);
  });

  it("counts every view and filters by status and search", () => {
    const result = queryEventRsvps(events, { status: "published", q: "book" });
    expect(result.counts).toMatchObject({ all: 3, published: 2, draft: 1 });
    expect(result.rows.map((row) => row.title)).toEqual(["Book launch"]);
    expect(result.rows[0]?.status.label).toBe("Published");
  });

  it("pages the result with links either side", () => {
    const result = queryEventRsvps(events, { limit: "25", offset: "0" });
    expect(result.limit).toBe(25);
    expect(result.prevHref).toBeNull();
    expect(result.nextHref).toBeNull();
  });
});
