import { describe, expect, it, vi } from "vitest";
import type { MirrorDelivery, ZohoMirrorLedgerReader } from "../ports/zoho-mirror.ports.js";
import { ZohoMirrorStatusService } from "./zoho-mirror-status.service.js";

const sent: MirrorDelivery = {
  eventId: 1,
  status: "succeeded",
  attempts: 1,
  nextRetryAt: null,
  providerReference: "Order:LAX-S-1",
  lastError: null,
  updatedAt: new Date("2026-11-14T16:02:00.000Z"),
};

function service(deliveries: Record<string, MirrorDelivery[]>) {
  const read = vi.fn<ZohoMirrorLedgerReader["read"]>(async (_entity, ids) => ({
    consumer: "zoho_fulfilment",
    deliveries: new Map(ids.map((id) => [id, deliveries[id] ?? []])),
  }));
  return { read, service: new ZohoMirrorStatusService({ read }) };
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
});
