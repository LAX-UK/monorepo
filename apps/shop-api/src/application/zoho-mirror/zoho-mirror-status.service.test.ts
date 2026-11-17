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
  options: { paid?: Record<string, boolean>; modes?: ZohoMirrorStatusDeps["modes"] } = {},
) {
  const read = vi.fn<ZohoMirrorLedgerReader["read"]>(async (_entity, ids) => ({
    consumer: "zoho_fulfilment",
    deliveries: new Map(ids.map((id) => [id, deliveries[id] ?? []])),
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
});
