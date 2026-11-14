import { ok } from "@auction/accounting-domain";
import { describe, expect, it, vi } from "vitest";
import type { IBooksHistoryReader } from "../../repositories/drizzle-books-history.reader.js";
import type { AccountingEvent } from "./accounting-event-routes.js";
import {
  AccountingProjectionNotYetError,
  AccountingProjectionRefusedError,
} from "./accounting-projection.service.js";
import { BACKFILL_MAX_LIMIT, BooksBackfill } from "./books-backfill.service.js";

const FROM = new Date("2027-01-01T00:00:00Z");
const TO = new Date("2027-01-08T00:00:00Z");
const ev = (id: number): AccountingEvent => ({
  id,
  eventType: "shop.accounting.order_paid",
  aggregateId: `order-${id}`,
  payload: {},
});

function harness(events: AccountingEvent[], shopBooks = "dry_run") {
  const asked: Parameters<IBooksHistoryReader["eventsInWindow"]>[0][] = [];
  const history = {
    eventsInWindow: vi.fn(async (input: Parameters<IBooksHistoryReader["eventsInWindow"]>[0]) => {
      asked.push(input);
      return events
        .filter((e) => input.afterId === null || e.id > input.afterId)
        .slice(0, input.limit);
    }),
  };
  const project = vi.fn(async (_e: AccountingEvent) => ({
    outcome: "projected" as const,
    created: 2,
    replayed: 0,
    kept: 0,
    parked: 0,
    cancelled: 0,
  }));
  const settings = {
    read: async () =>
      ok({
        bid: { xero: "off", books: "dry_run" },
        shop: { xero: "off", books: shopBooks },
        lax_art: { xero: "off", books: "off" },
      } as const),
  };
  const service = new BooksBackfill({
    history: history as never,
    projection: { project } as never,
    settings: settings as never,
  });
  return { service, project, asked };
}

const input = (over: object = {}) => ({
  product: "shop" as const,
  from: FROM,
  to: TO,
  afterId: null,
  dryRun: false,
  ...over,
});

describe("BooksBackfill", () => {
  it("reads only the product's own event types and projects each through the projection", async () => {
    const h = harness([ev(1), ev(2)]);
    const report = await h.service.run(input());
    expect(h.asked[0]?.eventTypes.every((t) => t.startsWith("shop."))).toBe(true);
    expect(h.asked[0]?.eventTypes.length).toBeGreaterThan(0);
    expect(report).toMatchObject({ events: 2, projected: 2, created: 4, next: null });
  });

  it("Bid reads no Shop event type", async () => {
    const h = harness([]);
    await h.service.run(input({ product: "bid" }));
    expect(h.asked[0]?.eventTypes.some((t) => t.startsWith("shop."))).toBe(false);
  });

  it("is bounded: never more than the maximum a run, and says where to go on", async () => {
    const events = Array.from({ length: BACKFILL_MAX_LIMIT + 5 }, (_, i) => ev(i + 1));
    const h = harness(events);
    const report = await h.service.run(input({ limit: 10_000 }));
    expect(h.asked[0]?.limit).toBe(BACKFILL_MAX_LIMIT);
    expect(report.events).toBe(BACKFILL_MAX_LIMIT);
    expect(report.next).toBe(BACKFILL_MAX_LIMIT);
    const rest = await h.service.run(input({ limit: 10_000, afterId: report.next }));
    expect(rest).toMatchObject({ events: 5, next: null });
  });

  it("a dry run projects nothing", async () => {
    const h = harness([ev(1)]);
    const report = await h.service.run(input({ dryRun: true }));
    expect(h.project).not.toHaveBeenCalled();
    expect(report).toMatchObject({ events: 1, projected: 0 });
  });

  it("stops at an event that must wait, so the next run starts there; a refused one is listed", async () => {
    const h = harness([ev(1), ev(2), ev(3)]);
    h.project
      .mockRejectedValueOnce(new AccountingProjectionRefusedError("bad_facts", "x"))
      .mockRejectedValueOnce(new AccountingProjectionNotYetError("invoice_in_flight", "y"));
    const report = await h.service.run(input());
    expect(report.refused).toEqual([{ eventId: 1, reason: "bad_facts" }]);
    expect(report.waiting?.eventId).toBe(2);
    expect(report.next).toBe(1);
  });

  it("a wait on the very first event still gives a place to go on from", async () => {
    const h = harness([ev(1)]);
    h.project.mockRejectedValueOnce(new AccountingProjectionNotYetError("invoice_in_flight", "y"));
    const report = await h.service.run(input());
    expect(report.next).toBe(0);
  });

  it.each([
    ["off", "product_not_aimed_at_books"],
    ["live", "books_live_not_in_rehearsal"],
  ])("refuses a product on Books %s", async (mode, code) => {
    const h = harness([ev(1)], mode);
    await expect(h.service.run(input())).rejects.toThrow(code);
    expect(h.project).not.toHaveBeenCalled();
  });

  it("refuses an empty window", async () => {
    const h = harness([]);
    await expect(h.service.run(input({ from: TO, to: FROM }))).rejects.toThrow("empty_window");
  });
});
