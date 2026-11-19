import { describe, expect, it, vi } from "vitest";
import type {
  MirrorDelivery,
  OrderPaymentStateReader,
  ZohoMirrorLedgerReader,
} from "../ports/zoho-mirror.ports.js";
import {
  type ZohoMirrorStatusDeps,
  ZohoMirrorStatusService,
} from "./zoho-mirror-status.service.js";

const sent: MirrorDelivery = {
  consumer: "zoho_fulfilment",
  eventId: 1,
  eventType: "shop.order.paid",
  status: "succeeded",
  attempts: 1,
  nextRetryAt: null,
  providerReference: "Order:LAX-S-1",
  lastError: null,
  updatedAt: new Date("2026-11-14T16:02:00.000Z"),
};

function service(
  deliveries: Record<string, MirrorDelivery[]>,
  options: {
    paid?: Record<string, boolean>;
    modes?: ZohoMirrorStatusDeps["modes"];
    artworkListingMode?: ZohoMirrorStatusDeps["artworkListingMode"];
    stockCodeConflictResolvedAt?: Map<string, Date>;
  } = {},
) {
  const read = vi.fn<ZohoMirrorLedgerReader["read"]>(async (_entity, ids) => ({
    consumer: "zoho_fulfilment",
    deliveries: new Map(ids.map((id) => [id, deliveries[id] ?? []])),
    ...(options.stockCodeConflictResolvedAt
      ? { stockCodeConflictResolvedAt: options.stockCodeConflictResolvedAt }
      : {}),
  }));
  const paidOf = vi.fn<OrderPaymentStateReader["paidOf"]>(
    async (ids) =>
      new Map(
        ids.flatMap((id) => (id in (options.paid ?? {}) ? [[id, !!options.paid?.[id]]] : [])),
      ),
  );
  const mirror = new ZohoMirrorStatusService({
    ledger: { read },
    orders: { paidOf },
    modes: options.modes ?? { order: null, artwork: null },
    artworkListingMode: options.artworkListingMode ?? null,
  });
  return { read, paidOf, service: mirror };
}

describe("ZohoMirrorStatusService", () => {
  it("answers a batch with one ledger read, one item per distinct id, in the order asked", async () => {
    const { read, service: mirror } = service({ a: [sent] });
    const items = await mirror.statuses("order", ["b", "a", "b"]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith("order", ["b", "a"]);
    expect(items.map((item) => [item.id, item.state, item.consumer])).toEqual([
      ["b", "not_applicable", "zoho_fulfilment"],
      ["a", "mirrored", "zoho_fulfilment"],
    ]);
  });

  it("answers one record in the same shape as the batch", async () => {
    const { service: mirror } = service({ a: [sent] });
    expect(await mirror.status("order", "a")).toEqual((await mirror.statuses("order", ["a"]))[0]);
  });

  it("asks once whether the orders with nothing sent are paid, and says an unpaid one is not sent", async () => {
    const { paidOf, service: mirror } = service({ a: [sent] }, { paid: { b: false, c: true } });
    const items = await mirror.statuses("order", ["a", "b", "c", "d"]);
    expect(paidOf).toHaveBeenCalledTimes(1);
    expect(paidOf).toHaveBeenCalledWith(["b", "c", "d"]);
    expect(items.map((item) => [item.id, item.state, item.notApplicableReason])).toEqual([
      ["a", "mirrored", null],
      ["b", "not_applicable", "not_paid"],
      ["c", "not_applicable", "not_sent_yet"],
      ["d", "not_applicable", "not_sent_yet"],
    ]);
  });

  it("says mirroring is off from the configured mode, without asking about payment", async () => {
    const { paidOf, service: mirror } = service(
      {},
      { paid: { b: false }, modes: { order: "off", artwork: "live" } },
    );
    expect(await mirror.status("order", "b")).toMatchObject({
      state: "not_applicable",
      notApplicableReason: "mirroring_off",
      mode: "off",
    });
    expect(paidOf).not.toHaveBeenCalled();
  });

  it("never asks about payment for artworks, and uses the write-back's mode for them", async () => {
    const { paidOf, service: mirror } = service(
      { r: [{ ...sent, status: "pending" }] },
      { modes: { order: "off", artwork: "dry_run" } },
    );
    expect(await mirror.status("artwork", "r")).toMatchObject({
      state: "pending",
      mode: "dry_run",
    });
    expect(paidOf).not.toHaveBeenCalled();
  });

  it("reads an artwork's listing deliveries against the listing's mode, not the write-back's", async () => {
    const { service: mirror } = service(
      {
        r: [
          {
            ...sent,
            consumer: "zoho_artwork_listing",
            eventType: "shop.artwork.updated",
            status: "dead_lettered",
          },
        ],
      },
      { modes: { order: null, artwork: "off" }, artworkListingMode: "live" },
    );
    expect(await mirror.status("artwork", "r")).toMatchObject({ state: "failed", mode: "live" });
  });

  it("passes each artwork's stock code conflict resolution to the reading", async () => {
    const conflict: MirrorDelivery = {
      ...sent,
      consumer: "zoho_artwork_writeback",
      eventType: "artwork_register.stock_code_assigned",
      status: "skipped",
      providerReference: null,
      lastError: "stock_code_conflict_raised",
    };
    const { service: mirror } = service(
      { resolved: [conflict], open: [conflict] },
      {
        modes: { order: null, artwork: "live" },
        stockCodeConflictResolvedAt: new Map([["resolved", new Date("2026-11-14T16:30:00.000Z")]]),
      },
    );
    const items = await mirror.statuses("artwork", ["resolved", "open"]);
    expect(items.map((item) => [item.id, item.state])).toEqual([
      ["resolved", "not_applicable"],
      ["open", "failed"],
    ]);
  });
});
