import type { BankTransferInstructions, PayPlan, PayPlanProgress } from "@auction/types";
import { describe, expect, it } from "vitest";
import { LOT_A, LOT_B, LOT_C, planOf } from "./pay-plan-fixtures.test-util";
import {
  buildPayProgressVm,
  formatSortCode,
  paymentUnderWay,
  progressSignature,
} from "./pay-progress.vm";

const CONTEXT = {
  returnTo: "/purchases/pay?lots=a,b,c",
  contactHref: "mailto:settlements@lax.bid",
  returned: null,
  details: {},
};

const DETAILS: BankTransferInstructions = {
  accountName: "London Auction Xchange LTD",
  sortCode: "231470",
  accountNumber: "41926638",
  reference: "LAXB7KQ2R9",
};

const lot = (lotId: string, title: string, totalPence: number) => ({
  lotId,
  title,
  lotNumber: 12,
  saleTitle: "Winter sale",
  totalPence,
});

const THREE = [
  lot(LOT_A, "Harbour at First Light", 525_000),
  lot(LOT_B, "Lowland Storm", 400_000),
  lot(LOT_C, "Coastal Notation", 245_100),
];

function progressOf(over: Partial<PayPlanProgress> = {}): PayPlanProgress {
  return {
    rail: "bank_transfer",
    stage: "awaiting_transfer",
    lots: THREE,
    totalPence: 1_170_100,
    receivedPence: 0,
    remainingPence: 1_170_100,
    receivedPercent: 0,
    otherInvoices: 0,
    ...over,
  };
}

const planWith = (progress: PayPlanProgress): PayPlan =>
  planOf([], {
    progress,
    leftOut: progress.lots.map((l) => ({ lotId: l.lotId, reason: "being_paid" as const })),
  });

const build = (progress: PayPlanProgress, transfer: BankTransferInstructions | null = DETAILS) =>
  buildPayProgressVm(planWith(progress), progress, CONTEXT, transfer);

describe("a bank transfer waiting for its money (S7)", () => {
  const vm = build(progressOf());

  it("is a transfer page with no way to pay again", () => {
    expect(vm.state).toBe("transfer");
    expect(vm.badge).toEqual({ label: "Waiting for your transfer", tone: "info", shape: "dot" });
    expect(vm.action).toBeNull();
    expect(vm.methods).toBeNull();
    expect(vm.railPay).toBeNull();
  });

  it("titles the payment by its lots and says it is one transfer", () => {
    expect(vm.title).toBe("Pay 3 invoices");
    expect(vm.subtitle).toBe("One bank transfer for 3 lots");
    expect(vm.lots.map((l) => l.title)).toEqual([
      "Harbour at First Light",
      "Lowland Storm",
      "Coastal Notation",
    ]);
    expect(vm.lots[0]?.detail).toEqual({
      subtitle: "Lot 12 · Winter sale",
      note: "Waiting for your transfer",
      total: "£5,250.00",
    });
  });

  it("shows the server's total as the amount to send", () => {
    expect(vm.money).toMatchObject({
      lines: [],
      totalLabel: "To send",
      total: "£11,701.00",
      due: null,
      meter: null,
    });
  });

  it("gives the account details exactly as the provider issued them, each copyable but the amount", () => {
    expect(vm.progress?.details?.rows).toEqual([
      { label: "Amount to send", value: "£11,701.00", copy: null },
      {
        label: "Account name",
        value: "London Auction Xchange LTD",
        copy: "London Auction Xchange LTD",
      },
      { label: "Sort code", value: "23-14-70", copy: "231470" },
      { label: "Account number", value: "41926638", copy: "41926638" },
      { label: "Reference", value: "LAXB7KQ2R9", copy: "LAXB7KQ2R9" },
    ]);
    expect(vm.progress?.detailsUnavailable).toBe(false);
  });

  it("says so, and never invents details, when the provider could not give them", () => {
    const missing = build(progressOf(), null);
    expect(missing.progress?.details).toBeNull();
    expect(missing.progress?.detailsUnavailable).toBe(true);
  });
});

describe("a bank transfer followed by someone who does not pay", () => {
  it("shows the money and the lots but not the account details", () => {
    const progress = progressOf();
    const plan = { ...planWith(progress), payerRole: "informed" as const };
    const vm = buildPayProgressVm(plan, progress, CONTEXT, DETAILS);
    expect(vm.progress?.details).toBeNull();
    expect(vm.progress?.detailsUnavailable).toBe(false);
    expect(vm.money?.total).toBe("£11,701.00");
  });
});

describe("a bank transfer that arrived in part (S8)", () => {
  const vm = build(
    progressOf({
      stage: "part_received",
      receivedPence: 600_000,
      remainingPence: 570_100,
      receivedPercent: 51,
    }),
  );

  it("says what has arrived and what is left, from the server's figures", () => {
    expect(vm.badge).toEqual({ label: "Part received", tone: "warning", shape: "dot" });
    expect(vm.notices).toEqual([
      {
        tone: "warning",
        title: "£6,000.00 of £11,701.00 received",
        detail:
          "Send the remaining £5,701.00 with the same reference. Your invoices are marked paid together once all of it has arrived.",
      },
    ]);
    expect(vm.money).toMatchObject({
      lines: [
        { label: "Total", amount: "£11,701.00" },
        { label: "Received", amount: "−£6,000.00" },
      ],
      totalLabel: "Left to send",
      total: "£5,701.00",
    });
  });

  it("shows the share received as a labelled bar with the reference", () => {
    expect(vm.money?.meter).toEqual({
      percent: 51,
      label: "£6,000.00 of £11,701.00 received",
      caption: "51% received · Reference LAXB7KQ2R9",
    });
  });

  it("keeps every invoice waiting: none is shown as paid before all of it is in", () => {
    expect(vm.lots.every((l) => l.detail?.note === "Waiting for your transfer")).toBe(true);
    expect(vm.action).toBeNull();
  });
});

describe("a payment that also covers invoices the link does not name", () => {
  it("says so beside the total", () => {
    const one = build(progressOf({ otherInvoices: 1 }));
    expect(one.money?.due).toBe("This payment also covers 1 other invoice.");
    const many = build(progressOf({ otherInvoices: 3 }));
    expect(many.money?.due).toBe("This payment also covers 3 other invoices.");
    expect(build(progressOf()).money?.due).toBeNull();
  });
});

describe("a card payment being confirmed (S6)", () => {
  const vm = build(
    progressOf({
      rail: "card",
      stage: "confirming",
      lots: [lot(LOT_A, "Coastal Notation", 237_500)],
      totalPence: 237_500,
      remainingPence: 237_500,
    }),
    null,
  );

  it("is a confirming page: the money is being paid, and there is nothing to press", () => {
    expect(vm.state).toBe("confirming");
    expect(vm.badge).toEqual({ label: "Confirming payment", tone: "info", shape: "dot" });
    expect(vm.title).toBe("Pay for Coastal Notation");
    expect(vm.money).toMatchObject({ totalLabel: "Being paid", total: "£2,375.00", lines: [] });
    expect(vm.action).toBeNull();
    expect(vm.progress?.details).toBeNull();
    expect(vm.progress?.detailsUnavailable).toBe(false);
  });

  it("carries what the page needs to watch it and to send the person to settlements", () => {
    expect(vm.progress).toMatchObject({
      stage: "confirming",
      signature: "confirming:0",
      lotIds: [LOT_A],
      refreshHref: CONTEXT.returnTo,
      contactHref: CONTEXT.contactHref,
    });
  });
});

describe("formatSortCode", () => {
  it("writes six digits as banks do", () => {
    expect(formatSortCode("231470")).toBe("23-14-70");
    expect(formatSortCode("23-14-70")).toBe("23-14-70");
  });

  it("leaves anything else as it came", () => {
    expect(formatSortCode("1234")).toBe("1234");
  });
});

describe("progressSignature", () => {
  it("changes with the stage and with the money received", () => {
    expect(progressSignature(progressOf())).toBe("awaiting_transfer:0");
    expect(progressSignature(progressOf({ stage: "part_received", receivedPence: 600_000 }))).toBe(
      "part_received:600000",
    );
  });

  it("reads none once the payment is no longer under way", () => {
    expect(progressSignature(null)).toBe("none");
  });
});

describe("paymentUnderWay", () => {
  it("is the payment only when nothing is left to pay in the link", () => {
    expect(paymentUnderWay(planWith(progressOf()))).not.toBeNull();
    expect(paymentUnderWay(planOf([]))).toBeNull();
  });
});
