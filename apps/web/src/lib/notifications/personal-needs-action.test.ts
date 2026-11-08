import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import { owedFor } from "@/lib/purchases/owed-fixtures.test-util";
import { type PurchaseSources, buildPurchasesVm } from "@/lib/purchases/purchases.vm";
import type { NeedsYouResponse } from "@/lib/workspace/needs-you-read";
import type { Lot, PortfolioRow } from "@auction/types";
import { describe, expect, it } from "vitest";
import { personalNeedsAction, personalNeedsActionRows } from "./personal-needs-action";

const NOW = new Date("2026-11-09T10:00:00Z");

function row(
  id: string,
  title: string,
  payment: PortfolioRow["payment"],
  total = "8000",
  endTime = "2026-10-24T18:00:00Z",
): PortfolioRow {
  return {
    lot: {
      id,
      saleId: "sale-2",
      lotNumber: 5,
      title,
      images: [],
      currentPrice: "6400",
      endTime: new Date(endTime),
      checkoutPricing: {
        hammerMajor: "6400",
        premiumMajor: "1600",
        totalMajor: total,
        policyId: "flat:lot",
        kind: "flat",
      },
      marketingDetails: {},
    } as unknown as Lot,
    payment,
  };
}

function facts(lotId: string, invoice: Partial<AccountPurchaseFacts["invoice"]>) {
  return {
    lotId,
    wonBy: { userId: "u-1", name: "Ada" },
    paymentRole: "payer",
    invoice: {
      status: "due",
      dueAt: null,
      paymentId: null,
      totalDue: "8000.00",
      stillToSendPence: null,
      ...invoice,
    },
    delivery: {
      stage: "awaiting_payment",
      method: null,
      carrier: null,
      trackingNumber: null,
      collectedBy: null,
      collectedAt: null,
      quote: null,
    },
  } as unknown as AccountPurchaseFacts;
}

function rowsFor(
  rows: PortfolioRow[],
  over: Partial<PurchaseSources> = {},
  gate: Parameters<typeof owedFor>[1] = "clear",
) {
  const base: Omit<PurchaseSources, "owedByLot"> = {
    rows,
    invoiceByLot: {},
    fulfilmentByLot: {},
    saleTitleById: { "sale-2": "Jewels and objects of vertu" },
    paymentRoleByLot: {},
    payerName: null,
    ...over,
  };
  const vm = buildPurchasesVm({ ...base, owedByLot: owedFor(base, gate), ...over });
  return personalNeedsActionRows(vm, { now: NOW });
}

describe("a person's Needs action, driven by money", () => {
  it("lists each amount to pay with its due date, soonest first, and the Pay link", () => {
    const rows = rowsFor(
      [
        row("later", "Later work", null, "1000", "2026-10-30T18:00:00Z"),
        row("sooner", "Sooner work", null, "2500", "2026-10-20T18:00:00Z"),
      ],
      {
        factsByLot: {
          later: facts("later", { dueAt: new Date("2026-11-20T00:00:00Z"), totalDue: "1000.00" }),
          sooner: facts("sooner", { dueAt: new Date("2026-11-12T00:00:00Z"), totalDue: "2500.00" }),
        },
      },
    );
    expect(rows.map((r) => r.title)).toEqual([
      "Pay £2,500.00 for “Sooner work”",
      "Pay £1,000.00 for “Later work”",
    ]);
    expect(rows[0]).toMatchObject({
      key: "pay:sooner",
      topic: "purchase",
      action: { label: "Pay", href: "/purchases/pay?lots=sooner" },
      due: { tone: "warning", dateTime: "2026-11-12T00:00:00.000Z" },
    });
    expect(rows[0]?.due?.text).toMatch(/^Due /);
    expect(rows[0]?.detail).toContain("Pay by 12 November");
  });

  it("marks an overdue invoice as overdue", () => {
    const [only] = rowsFor([row("old", "Old work", null)], {
      factsByLot: {
        old: facts("old", { status: "overdue", dueAt: new Date("2026-11-01T00:00:00Z") }),
      },
    });
    expect(only?.due).toMatchObject({ text: "Overdue", tone: "danger" });
  });

  it("puts payments waiting after the amounts to pay, and says what is still to send", () => {
    const rows = rowsFor(
      [
        row("wait", "Waiting work", { id: "p1", status: "authorized", manualReviewReason: null }),
        row("pay", "Owed work", null),
        row("part", "Part-paid work", { id: "p2", status: "authorized", manualReviewReason: null }),
      ],
      { factsByLot: { part: facts("part", { status: "processing", stillToSendPence: 30_005 }) } },
    );
    expect(rows.map((r) => r.key)).toEqual(["pay:pay", "waiting:part", "waiting:wait"]);
    const part = rows.find((r) => r.key === "waiting:part");
    expect(part).toMatchObject({
      title: "£300.05 still to send on your bank transfer",
      action: { label: "See transfer details", href: "/purchases/pay?lots=part" },
    });
    const wait = rows.find((r) => r.key === "waiting:wait");
    expect(wait?.title).toBe("Payment for “Waiting work”");
    expect(wait?.detail).toContain("being confirmed");
    expect(wait?.action).toEqual({ label: "View", href: "/purchases/wait" });
  });

  it("lists holds that stop a payment last, with the reason and the way to clear it", () => {
    const rows = rowsFor(
      [row("held", "Held work", null), row("done", "Done work", null)],
      {},
      "source_of_funds_required",
    );
    expect(rows.every((r) => r.key.startsWith("hold:"))).toBe(true);
    expect(rows[0]).toMatchObject({
      title: "Payment on hold for “Held work”",
      detail: "We need to confirm the source of funds before you pay",
      topic: "account",
    });
    expect(rows[0]?.action.label).toBe("Provide documents");
  });

  it("never lists a purchase an organisation pays, nor one already paid or ended", () => {
    const rows = rowsFor(
      [
        row("org", "Organisation work", null),
        row("paid", "Paid work", { id: "p3", status: "captured", manualReviewReason: null }),
        row("refunded", "Refunded work", {
          id: "p4",
          status: "refunded",
          manualReviewReason: null,
        }),
      ],
      { paymentRoleByLot: { org: "informed" } },
    );
    expect(rows).toEqual([]);
  });

  it("lists nothing for a person who owes nothing", () => {
    expect(rowsFor([])).toEqual([]);
  });

  it("states the same amount Purchases shows for the purchase", () => {
    const base = [row("one", "One", null, "1150")];
    const vm = buildPurchasesVm({
      rows: base,
      invoiceByLot: {},
      fulfilmentByLot: {},
      saleTitleById: {},
      paymentRoleByLot: {},
      payerName: null,
      owedByLot: owedFor({ rows: base, fulfilmentByLot: {}, paymentRoleByLot: {} }),
    });
    const card = vm.cardsByTab["to-pay"][0];
    const [needs] = personalNeedsActionRows(vm, { now: NOW });
    expect(needs?.title).toBe(`Pay ${card?.amount} for “One”`);
  });
});

describe("a person's whole Needs action: money first, then every other task", () => {
  const ctx = { name: "Ada Lovelace", now: NOW, actor: { role: "owner" as const } };
  const emptyPurchases = { cardsByTab: { "to-pay": [], "in-progress": [], completed: [] } };
  const response = (tasks: NeedsYouResponse["tasks"]): NeedsYouResponse => ({
    kinds: [],
    tasks,
    counts: {},
    truncated: false,
  });
  const owedPurchases = () => {
    const base = [row("one", "One", null, "1150")];
    return buildPurchasesVm({
      rows: base,
      invoiceByLot: {},
      fulfilmentByLot: {},
      saleTitleById: {},
      paymentRoleByLot: {},
      payerName: null,
      owedByLot: owedFor({ rows: base, fulfilmentByLot: {}, paymentRoleByLot: {} }),
    });
  };

  const OPEN_LOT = { id: "l1", title: "Open lot", endsAt: new Date("2026-11-10T12:00:00Z") };
  const CLOSED_LOT = { id: "l2", title: "Closed lot", endsAt: new Date("2026-11-08T12:00:00Z") };

  it("keeps every non-money task the reader lists, one row each, after the money rows", () => {
    const tasks = [
      {
        kind: "outbid",
        lots: [OPEN_LOT],
        raisedAt: null,
        link: { page: "lot", id: "l1" },
      },
      {
        kind: "agreement",
        consignment: { id: "c1", title: "Blue study" },
        raisedAt: null,
        link: { page: "consignment", id: "c1" },
      },
      {
        kind: "changes",
        submission: { id: "s1", title: "Red field" },
        note: "Please add a photo of the back",
        raisedAt: null,
        link: { page: "consignment", id: "s1" },
      },
      {
        kind: "reply",
        consignment: { id: "c2", title: "Green line" },
        from: "Cat Alogue",
        raisedAt: null,
        link: { page: "consignment_messages", id: "c2" },
      },
      { kind: "identity", raisedAt: null, link: { page: "verify_identity" } },
      { kind: "source_of_funds", raisedAt: null, link: { page: "source_of_funds" } },
    ] as unknown as NeedsYouResponse["tasks"];
    const { rows, failed } = personalNeedsAction({
      purchases: owedPurchases(),
      response: response(tasks),
      ctx,
    });
    expect(failed).toBe(false);
    expect(rows.map((r) => r.key)).toEqual([
      "pay:one",
      "outbid",
      "agreement:c1",
      "changes:s1",
      "reply:c2",
      "identity",
      "source_of_funds",
    ]);
  });

  it("names each kind with its own action", () => {
    const tasks = [
      { kind: "identity", raisedAt: null, link: { page: "verify_identity" } },
      { kind: "source_of_funds", raisedAt: null, link: { page: "source_of_funds" } },
      {
        kind: "agreement",
        consignment: { id: "c1", title: "Blue study" },
        raisedAt: null,
        link: { page: "consignment", id: "c1" },
      },
    ] as unknown as NeedsYouResponse["tasks"];
    const { rows } = personalNeedsAction({
      purchases: emptyPurchases,
      response: response(tasks),
      ctx,
    });
    expect(rows.map((r) => r.action.href)).toEqual([
      "/verify-identity",
      "/compliance/source-of-funds",
      "/selling/consignments/c1#agreement",
    ]);
  });

  it("shows an outbid lot only while it is open, and drops the row when none is", () => {
    const outbid = (lots: (typeof OPEN_LOT)[]) =>
      [
        { kind: "outbid", lots, raisedAt: null, link: { page: "bids" } },
      ] as unknown as NeedsYouResponse["tasks"];
    const mixed = personalNeedsAction({
      purchases: emptyPurchases,
      response: response(outbid([OPEN_LOT, CLOSED_LOT])),
      ctx,
    });
    expect(mixed.rows).toHaveLength(1);
    expect(mixed.rows[0]?.title).toBe("Outbid on “Open lot”");
    const closed = personalNeedsAction({
      purchases: emptyPurchases,
      response: response(outbid([CLOSED_LOT])),
      ctx,
    });
    expect(closed.rows).toEqual([]);
  });

  it("does not list the reader's pay rows twice: the money rows carry them", () => {
    const tasks = [
      {
        kind: "pay",
        purchases: [{ id: "one", title: "One" }],
        raisedAt: null,
        link: { page: "purchase", id: "one" },
      },
    ] as unknown as NeedsYouResponse["tasks"];
    const { rows } = personalNeedsAction({
      purchases: owedPurchases(),
      response: response(tasks),
      ctx,
    });
    expect(rows.map((r) => r.key)).toEqual(["pay:one"]);
  });

  it("counts what it lists, so the tab and the rows agree", () => {
    const tasks = [
      { kind: "identity", raisedAt: null, link: { page: "verify_identity" } },
    ] as unknown as NeedsYouResponse["tasks"];
    const { rows } = personalNeedsAction({
      purchases: owedPurchases(),
      response: response(tasks),
      ctx,
    });
    expect(rows).toHaveLength(2);
  });
});
