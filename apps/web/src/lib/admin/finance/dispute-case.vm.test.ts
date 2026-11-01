import { describe, expect, it } from "vitest";
import { sharedCase } from "./dispute-case.fixture";
import {
  disputeAllocationMode,
  disputeCaseHeader,
  disputeDeadlineBlock,
  disputeInvoiceRows,
  disputeTimelineEvents,
} from "./dispute-case.vm";

const now = new Date("2026-11-01T12:00:00Z");
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

describe("disputeAllocationMode", () => {
  it("lets finance allocate a shared charge", () => {
    expect(disputeAllocationMode(sharedCase())).toBe("allocate");
  });
  it("has nothing to allocate to when no payment matched", () => {
    expect(disputeAllocationMode(sharedCase({ invoiceCount: 0 }))).toBe("unmatched");
  });
  it("shows a saved allocation", () => {
    expect(
      disputeAllocationMode(
        sharedCase({ awaitingAllocation: false, allocationState: "allocated" }),
      ),
    ).toBe("allocated");
  });
  it("needs none for a case that ended without a loss", () => {
    expect(disputeAllocationMode(sharedCase({ awaitingAllocation: false }))).toBe("not_needed");
  });
});

describe("disputeCaseHeader", () => {
  it("titles the case with its amount and reason", () => {
    const header = disputeCaseHeader(sharedCase());
    expect(header.title).toBe("£14,200.00 · Fraudulent");
    expect(header.status.label).toBe("Needs response");
    expect(header.allocation.label).toBe("Needs allocation");
  });
});

describe("disputeDeadlineBlock", () => {
  const format = (value: string) => `at ${value.slice(0, 10)}`;

  it("leads with the days left", () => {
    expect(disputeDeadlineBlock(sharedCase({ dueBy: inDays(10) }), now, format)).toEqual({
      headline: "10 days left",
      tone: null,
      detail: `Respond by at ${inDays(10).slice(0, 10)}`,
    });
  });
  it("is a badge when the date is close", () => {
    expect(disputeDeadlineBlock(sharedCase({ dueBy: inDays(2) }), now, format)).toMatchObject({
      headline: "2 days left",
      tone: "danger",
    });
  });
  it("says the case is closed once it is", () => {
    expect(disputeDeadlineBlock(sharedCase({ status: "lost" }), now, format)).toEqual({
      headline: "Closed",
      tone: null,
      detail: null,
    });
  });
});

describe("disputeTimelineEvents", () => {
  it("writes each entry as a sentence with money and who did it", () => {
    const events = disputeTimelineEvents(
      [
        { id: "closed", kind: "closed", at: "2026-11-20T08:00:00.000Z", actor: "Stripe" },
        {
          id: "allocated",
          kind: "allocated_by_staff",
          at: "2026-11-02T10:00:00.000Z",
          actor: "Hana Ito",
          invoiceCount: 3,
        },
        {
          id: "funds_withdrawn",
          kind: "funds_withdrawn",
          at: "2026-10-31T02:10:00.000Z",
          actor: "Stripe",
          amountPence: 1_420_000,
        },
      ],
      "gbp",
      "lost",
    );
    expect(events.map((e) => e.title)).toEqual([
      "Dispute lost",
      "Allocated to 3 invoices",
      "Funds withdrawn: £14,200.00",
    ]);
    expect(events[1]?.actor).toBe("Hana Ito");
  });
});

describe("disputeInvoiceRows", () => {
  it("pairs each invoice with the line saved for it", () => {
    const found = sharedCase({
      allocations: [
        {
          paymentId: "p2",
          amountPence: 320_000,
          sellerSharePence: 288_000,
          clawback: "withdrawn",
          source: "staff",
          allocatedByName: "Hana Ito",
          allocatedAt: "2026-11-02T10:00:00.000Z",
        },
      ],
    });
    const rows = disputeInvoiceRows(found);
    expect(rows.map((r) => r.line?.amountPence ?? null)).toEqual([null, 320_000, null]);
  });
});
