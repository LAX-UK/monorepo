import type { DisputeDeskAllocationLine } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildDisputeTimeline } from "./dispute-timeline.js";

const base = {
  status: "needs_response",
  amountPence: 1_420_000,
  openedAt: "2026-10-30T09:14:00.000Z",
  closedAt: null,
  fundsWithdrawnAt: null,
  fundsReinstatedAt: null,
  allocations: [] as DisputeDeskAllocationLine[],
};

const line = (patch: Partial<DisputeDeskAllocationLine>): DisputeDeskAllocationLine => ({
  paymentId: "p1",
  amountPence: 1_420_000,
  sellerSharePence: 1_000_000,
  clawback: "none",
  source: "staff",
  allocatedByName: "Hana Ito",
  allocatedAt: "2026-11-02T10:00:00.000Z",
  ...patch,
});

describe("buildDisputeTimeline", () => {
  it("starts with the dispute being opened", () => {
    expect(buildDisputeTimeline(base)).toEqual([
      { id: "opened", kind: "opened", at: base.openedAt, actor: "Stripe" },
    ]);
  });

  it("lists everything newest first, naming who allocated it", () => {
    const entries = buildDisputeTimeline({
      ...base,
      fundsWithdrawnAt: "2026-10-31T02:10:00.000Z",
      allocations: [line({}), line({ paymentId: "p2" })],
    });
    expect(entries.map((e) => e.kind)).toEqual(["allocated_by_staff", "funds_withdrawn", "opened"]);
    expect(entries[0]).toMatchObject({ actor: "Hana Ito", invoiceCount: 2 });
    expect(entries[1]).toMatchObject({ amountPence: 1_420_000 });
  });

  it("credits an automatic allocation to Bid", () => {
    const [entry] = buildDisputeTimeline({
      ...base,
      allocations: [line({ source: "automatic", allocatedByName: null })],
    });
    expect(entry).toMatchObject({ kind: "allocated_automatically", actor: "Bid" });
  });

  it("falls back to Finance when the allocating person is no longer known", () => {
    const [entry] = buildDisputeTimeline({
      ...base,
      allocations: [line({ allocatedByName: null })],
    });
    expect(entry?.actor).toBe("Finance");
  });

  it("ends with the close and the funds coming back", () => {
    const entries = buildDisputeTimeline({
      ...base,
      status: "won",
      closedAt: "2026-11-20T08:00:00.000Z",
      fundsReinstatedAt: "2026-11-20T08:00:00.000Z",
    });
    expect(entries.map((e) => e.kind).sort()).toEqual(["closed", "funds_reinstated", "opened"]);
  });
});
