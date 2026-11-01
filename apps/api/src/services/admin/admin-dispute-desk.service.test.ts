import type { DisputeDeskCaseRecord } from "@auction/persistence/interfaces";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { AdminDisputeDeskService } from "./admin-dispute-desk.service.js";

const record: DisputeDeskCaseRecord = {
  id: "case-1",
  stripeDisputeId: "dp_1",
  status: "needs_response",
  allocationState: "needs_allocation",
  awaitingAllocation: true,
  amountPence: 14_200_00,
  currency: "gbp",
  reason: "fraudulent",
  dueBy: "2026-11-06T23:59:00.000Z",
  evidenceSubmitted: false,
  openedAt: "2026-10-30T09:14:00.000Z",
  closedAt: null,
  invoiceCount: 3,
  lotTitle: null,
  buyerId: "u1",
  buyerLabel: "Hartley Collection Ltd",
  sellerNames: ["Northbank Gallery"],
  networkReasonCode: null,
  cardBrand: "visa",
  cardLast4: "4242",
  chargeId: "ch_1",
  version: 1,
  fundsWithdrawnAt: "2026-10-31T02:10:00.000Z",
  fundsReinstatedAt: null,
  invoices: [],
  allocations: [],
};

function build() {
  const reader = {
    listPage: vi.fn().mockResolvedValue({ rows: [], hasNextPage: false, counts: {} }),
    findCase: vi.fn().mockResolvedValue(record),
  };
  const allocator = { allocate: vi.fn().mockResolvedValue(ok({ caseId: "case-1", version: 2 })) };
  return { reader, allocator, service: new AdminDisputeDeskService(reader, allocator) };
}

describe("AdminDisputeDeskService", () => {
  it("lists through the reader", async () => {
    const { service, reader } = build();
    const input = { view: "open" as const, limit: 50, offset: 0 };
    await service.listCases(input);
    expect(reader.listPage).toHaveBeenCalledWith(input);
  });

  it("opens a case with its timeline, newest first", async () => {
    const { service } = build();
    const found = await service.getCase("case-1");
    expect(found?.timeline.map((e) => e.kind)).toEqual(["funds_withdrawn", "opened"]);
  });

  it("returns null for a case that does not exist", async () => {
    const { service, reader } = build();
    reader.findCase.mockResolvedValue(null);
    expect(await service.getCase("missing")).toBeNull();
  });

  it("hands an allocation to the allocator unchanged", async () => {
    const { service, allocator } = build();
    const input = {
      caseId: "case-1",
      expectedVersion: 1,
      lines: [{ paymentId: "p1", amountPence: 14_200_00 }],
      actorUserId: "staff-1",
      note: "One charge for three lots.",
    };
    const result = await service.allocate(input);
    expect(allocator.allocate).toHaveBeenCalledWith(input);
    expect(result.isOk()).toBe(true);
  });
});
