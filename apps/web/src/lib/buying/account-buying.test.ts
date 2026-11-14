import type { AccountScope } from "@/lib/account-scope/account-scope";
import { buildMyBidsVm } from "@/lib/bid/my-bids.vm";
import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import { attentionChip } from "@/lib/navigation/client-attention";
import { deriveClientAttention } from "@/lib/navigation/derive-client-attention";
import { owedFor } from "@/lib/purchases/owed-fixtures.test-util";
import { type PurchaseSources, buildPurchasesVm } from "@/lib/purchases/purchases.vm";
import { type AccountHold, type AmountOwedEntry, summariseAmountsOwed } from "@auction/domain";
import type { LegalEntityMemberRole, Lot, PaymentStatus, PortfolioRow } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { openBidsFigure, paymentRoleFor, purchasesToPayFigure } from "./account-buying-figures";
import { createAccountBuyingReader } from "./account-buying-reader";
import { buyingPageView } from "./buying-pages";

const ME = "user-me";
const COLLEAGUE = "user-colleague";
const ORG = "org-northbank";
const NOW = Date.parse("2026-10-29T12:00:00Z");

function organisation(role: LegalEntityMemberRole, isImpersonation = false): AccountScope {
  return {
    account: {
      kind: "organisation",
      id: ORG,
      name: "Northbank Gallery",
      actor: { role, isImpersonation },
    },
    actor: { userId: ME },
  };
}

const personal: AccountScope = {
  account: { kind: "personal", id: "me-personal" },
  actor: { userId: ME },
};

function lot(id: string, overrides: Partial<Lot> = {}): Lot {
  return {
    id,
    saleId: null,
    lotNumber: Number(id.replace(/\D/g, "")) || null,
    title: `Work ${id}`,
    images: [],
    currentPrice: "1000",
    startTime: new Date(NOW - 3_600_000),
    endTime: new Date(NOW + 3_600_000),
    status: "active",
    winnerId: null,
    buyerLegalEntityId: null,
    marketingDetails: {},
    ...overrides,
  } as unknown as Lot;
}

function bid(
  lotRow: Lot,
  amount: string,
  opts: { winning?: boolean; max?: string } = {},
): BidWithLot {
  return {
    bid: {
      id: `bid-${lotRow.id}-${amount}`,
      lotId: lotRow.id,
      amount,
      isWinning: opts.winning ?? false,
      isAutoBid: false,
      maxAutoBidAmount: opts.max ?? null,
      placedByUserId: ME,
      buyerLegalEntityId: ORG,
      createdAt: new Date(NOW - Number(amount)),
    },
    lot: lotRow,
  } as unknown as BidWithLot;
}

function purchase(id: string, status: PaymentStatus | null, winnerId = COLLEAGUE): PortfolioRow {
  return {
    lot: lot(id, {
      status: "ended",
      winnerId,
      buyerLegalEntityId: ORG,
      endTime: new Date(NOW - 86_400_000),
      checkoutPricing: {
        hammerMajor: "1000",
        premiumMajor: "250",
        totalMajor: "1250",
        policyId: "flat:lot",
        kind: "flat",
      },
    }),
    payment: status ? { id: `pay-${id}`, status, manualReviewReason: null } : null,
  };
}

/** An organisation's records: three open lots (one outbid), and five won lots in every state. */
const winningLot = lot("lot-1", { currentPrice: "1000" });
const outbidLot = lot("lot-2", { currentPrice: "3000" });
const scheduledLot = lot("lot-3", { status: "scheduled" });
const BIDS: BidWithLot[] = [
  bid(winningLot, "1000", { winning: true, max: "1500" }),
  bid(winningLot, "800"),
  bid(outbidLot, "2500"),
  bid(scheduledLot, "400"),
  bid(lot("lot-4", { status: "ended", winnerId: "someone-else" }), "900"),
];
const PURCHASES: PortfolioRow[] = [
  purchase("lot-11", null),
  purchase("lot-12", "pending"),
  purchase("lot-13", "requires_manual_review"),
  purchase("lot-14", "authorized"),
  purchase("lot-15", "captured"),
  purchase("lot-16", "refunded"),
  // An abandoned checkout: its only payment row is cancelled, but the buyer still owes, so it
  // counts everywhere and Pay stays available.
  purchase("lot-17", "cancelled"),
];

function purchaseSources(
  scope: AccountScope,
  rows: readonly PortfolioRow[],
  fulfilmentByLot: PurchaseSources["fulfilmentByLot"] = {},
  gate: AccountHold = "clear",
): PurchaseSources {
  const paymentRoleByLot = Object.fromEntries(
    rows.map((row) => [row.lot.id, paymentRoleFor(scope, row)]),
  );
  return {
    rows,
    invoiceByLot: {},
    fulfilmentByLot,
    owedByLot: owedFor({ rows, fulfilmentByLot, paymentRoleByLot }, gate),
    saleTitleById: {},
    paymentRoleByLot,
    payerName: scope.account.kind === "organisation" ? scope.account.name : null,
  };
}

/** What the account owes for the rows: the one reading every figure below is drawn from. */
function owedEntries(sources: PurchaseSources): AmountOwedEntry[] {
  return Object.values(sources.owedByLot);
}

describe("Home, the lists and the menu agree", () => {
  it("counts the same open bids on Home and in the Bids page's Active view", () => {
    const vm = buildMyBidsVm({ rows: BIDS, userId: ME, saleTitleById: {} });
    const figure = openBidsFigure(BIDS, ME);
    expect(figure.lots).toBe(vm.cardsByTab.active.length);
    expect(figure.lots).toBe(3);
    // The most committed on each open lot: 1,500 (auto-bid ceiling) + 2,500 + 400.
    expect(figure.totalMax).toEqual([{ currency: "GBP", amount: "4400.00" }]);
  });

  it.each(["owner", "admin", "finance"] as const)(
    "counts the same purchases to pay on Home, in Purchases and in the %s's menu",
    (role) => {
      const scope = organisation(role);
      const sources = purchaseSources(scope, PURCHASES);
      const vm = buildPurchasesVm(sources);
      const toPayTab = vm.cardsByTab["to-pay"].length;
      const figure = purchasesToPayFigure(owedEntries(sources));
      const attention = deriveClientAttention({
        userId: ME,
        bids: [],
        amountsOwed: owedEntries(sources),
        stillToSend: [],
        unreadNotifications: [],
      });
      expect(figure.purchases).toBe(4);
      expect(vm.cardsByTab["to-pay"].map((card) => card.lotId)).toContain("lot-17");
      expect(vm.cardsByTab.completed.map((card) => card.lotId)).not.toContain("lot-17");
      expect(toPayTab).toBe(figure.purchases);
      expect(attention.paymentsDue).toBe(figure.purchases);
      expect(figure.totals).toEqual([{ currency: "GBP", amount: "5000.00" }]);
      // One payment covers what can be paid now; the lot held for checks waits on its own row.
      expect(vm.payNow?.title).toBe("3 invoices · £3,750.00 due");
    },
  );

  it("ends a purchase only when the sale is cancelled, whatever its payment row says", () => {
    const scope = organisation("owner");
    const sources = purchaseSources(scope, PURCHASES, {
      "lot-17": { status: "cancelled" } as never,
    });
    const vm = buildPurchasesVm(sources);
    expect(vm.cardsByTab["to-pay"].map((card) => card.lotId)).not.toContain("lot-17");
    expect(vm.cardsByTab.completed.map((card) => card.lotId)).toContain("lot-17");
    // Home, the chip and the menu count it out too: Purchases and the chip cannot disagree.
    expect(purchasesToPayFigure(owedEntries(sources)).purchases).toBe(3);
    expect(
      deriveClientAttention({
        userId: ME,
        bids: [],
        amountsOwed: owedEntries(sources),
        stillToSend: [],
        unreadNotifications: [],
      }).paymentsDue,
    ).toBe(3);
  });

  it("ends an unpaid purchase cancelled at fulfilment for a personal account too", () => {
    const rows = [
      {
        ...purchase("lot-41", null, ME),
        lot: { ...purchase("lot-41", null, ME).lot, buyerLegalEntityId: "me-personal" },
      },
      {
        ...purchase("lot-42", "pending", ME),
        lot: { ...purchase("lot-42", "pending", ME).lot, buyerLegalEntityId: "me-personal" },
      },
    ];
    const sources = purchaseSources(personal, rows, { "lot-42": { status: "cancelled" } as never });
    const attention = deriveClientAttention({
      userId: ME,
      bids: [],
      amountsOwed: owedEntries(sources),
      stillToSend: [],
      unreadNotifications: [],
    });
    expect(attention.paymentsDue).toBe(1);
    expect(buildPurchasesVm(sources).cardsByTab.completed.map((card) => card.lotId)).toEqual([
      "lot-42",
    ]);
  });

  it("says the account is in review, not that payment is due, while checks are open", () => {
    const sources = purchaseSources(
      organisation("finance"),
      PURCHASES,
      {},
      "source_of_funds_required",
    );
    const attention = deriveClientAttention({
      userId: ME,
      bids: [],
      amountsOwed: owedEntries(sources),
      stillToSend: [],
      unreadNotifications: [],
    });
    expect(attention).toMatchObject({ paymentsDue: 4, paymentsInReview: true });
    expect(attentionChip(attention)).toMatchObject({ label: "Account in review" });
    // Purchases agrees: one banner, one action, and no row repeats it.
    const vm = buildPurchasesVm(sources);
    expect(vm.payNow).toMatchObject({
      kind: "review",
      documentsAction: { label: "Provide documents" },
    });
    expect(vm.cardsByTab["to-pay"].every((card) => card.primaryAction === null)).toBe(true);
  });

  it("never asks a buyer agent to pay, while Purchases still lists what they won", () => {
    const scope = organisation("buyer_agent");
    const won = PURCHASES.map((row) => ({ ...row, lot: { ...row.lot, winnerId: ME } }));
    const vm = buildPurchasesVm(purchaseSources(scope, won));
    expect(summariseAmountsOwed(owedEntries(purchaseSources(scope, won))).count).toBe(0);
    expect(vm.payNow).toBeNull();
    expect(vm.cardsByTab["to-pay"].every((card) => card.payable === null)).toBe(true);
    expect(
      vm.cardsByTab["to-pay"].map((card) => [
        card.statusLabel,
        card.statusNote,
        card.primaryAction,
      ]),
    ).toEqual([
      ["Awaiting payment", "Waiting for payment by Northbank Gallery", null],
      ["Awaiting payment", "Waiting for payment by Northbank Gallery", null],
      ["Awaiting payment", "Waiting for payment by Northbank Gallery", null],
      ["Awaiting payment", "Waiting for payment by Northbank Gallery", null],
    ]);
    const paid = buildPurchasesVm(purchaseSources(scope, won)).cardsByTab["in-progress"];
    expect(paid.find((card) => card.lotId === "lot-15")?.breakdown).toContainEqual({
      label: "Paid by",
      value: "Northbank Gallery's finance team",
    });
  });
});

describe("a lot whose estimate is in dollars", () => {
  const usdEstimate = {
    estimate: { low: "50000", high: "70000", currency: "USD" },
  } as Lot["marketingDetails"];

  it("is bid on and charged in pounds, whatever currency its estimate is in", () => {
    const open = lot("lot-31", { status: "scheduled", marketingDetails: usdEstimate });
    const [card] = buildMyBidsVm({ rows: [bid(open, "45000")], userId: ME }).cardsByTab.active;
    const figures = Object.fromEntries((card?.figures ?? []).map((f) => [f.label, f.value]));
    expect(figures["your maximum"]).toBe("£45,000.00");

    const live = lot("lot-32", { currentPrice: "55000", marketingDetails: usdEstimate });
    const [liveCard] = buildMyBidsVm({ rows: [bid(live, "45000")], userId: ME }).cardsByTab.active;
    expect(liveCard?.figures.find((f) => f.label === "current bid")).toMatchObject({
      value: "£55,000.00",
    });
    const steps = [liveCard?.next, ...(liveCard?.more ?? [])].map((a) => a?.label).join(" ");
    expect(steps).toMatch(/£/);
    expect(steps).not.toMatch(/\$/);
  });

  it("totals and charges in pounds on Purchases and Home", () => {
    const dollars = purchase("lot-21", null);
    dollars.lot.marketingDetails = usdEstimate;
    const rows = [dollars, purchase("lot-22", null)];
    const vm = buildPurchasesVm(purchaseSources(organisation("finance"), rows));
    expect(vm.payNow?.title).toBe("2 invoices · £2,500.00 due");
    expect(vm.cardsByTab["to-pay"].find((card) => card.lotId === "lot-21")?.amount).toBe(
      "£1,250.00",
    );
    expect(
      purchasesToPayFigure(owedEntries(purchaseSources(organisation("finance"), rows))).totals,
    ).toEqual([{ currency: "GBP", amount: "2500.00" }]);
  });
});

describe("paymentRoleFor", () => {
  it("lets the winner pay a personal purchase", () => {
    const row = purchase("lot-1", null, ME);
    expect(
      paymentRoleFor(personal, { lot: { ...row.lot, buyerLegalEntityId: "me-personal" } }),
    ).toBe("payer");
  });

  it("tells the person about a lot they won for an organisation, seen from their own account", () => {
    expect(paymentRoleFor(personal, purchase("lot-1", null, ME))).toBe("informed");
  });

  it.each([
    ["finance", "payer"],
    ["viewer", "none"],
  ] as const)("gives an organisation's %s the role %s", (role, expected) => {
    expect(paymentRoleFor(organisation(role), purchase("lot-1", null))).toBe(expected);
  });

  it("never lets support staff viewing as the organisation pay", () => {
    expect(paymentRoleFor(organisation("owner", true), purchase("lot-1", null))).toBe("none");
  });
});

describe("createAccountBuyingReader", () => {
  function sources() {
    return {
      personal: {
        bids: vi.fn(async () => []),
        purchases: vi.fn(async () => []),
        amountsOwed: vi.fn(async () => ({ entries: [], stillToSend: [] })),
      },
      organisation: {
        bids: vi.fn(async () => BIDS),
        purchases: vi.fn(async () => PURCHASES),
        amountsOwed: vi.fn(async () => ({ entries: [], stillToSend: [] })),
      },
    };
  }

  it("reads the organisation's records, never the person's own, while acting for it", async () => {
    const s = sources();
    const reader = createAccountBuyingReader({ current: async () => organisation("admin") }, s);
    expect(await reader.bids()).toBe(BIDS);
    expect(await reader.purchases()).toBe(PURCHASES);
    expect(s.organisation.bids).toHaveBeenCalledWith(ORG);
    expect(s.personal.bids).not.toHaveBeenCalled();
    expect(s.personal.purchases).not.toHaveBeenCalled();
    await reader.amountsOwed();
    expect(s.organisation.amountsOwed).toHaveBeenCalledWith(ORG);
    expect(s.personal.amountsOwed).not.toHaveBeenCalled();
  });

  it("reads a personal account by its id while support views it, never the staff member's own", async () => {
    const s = sources();
    const viewed: AccountScope = {
      account: { kind: "personal", id: "client-personal", isImpersonation: true },
      actor: { userId: "staff-1" },
    };
    const reader = createAccountBuyingReader({ current: async () => viewed }, s);
    await reader.bids();
    await reader.purchases();
    await reader.amountsOwed();
    expect(s.organisation.bids).toHaveBeenCalledWith("client-personal");
    expect(s.organisation.purchases).toHaveBeenCalledWith("client-personal");
    expect(s.organisation.amountsOwed).toHaveBeenCalledWith("client-personal");
    expect(s.personal.bids).not.toHaveBeenCalled();
    expect(s.personal.purchases).not.toHaveBeenCalled();
    expect(s.personal.amountsOwed).not.toHaveBeenCalled();
  });

  it("reads the person's own records in their own account, once per reader", async () => {
    const s = sources();
    const reader = createAccountBuyingReader({ current: async () => personal }, s);
    await Promise.all([
      reader.bids(),
      reader.bids(),
      reader.purchases(),
      reader.amountsOwed(),
      reader.amountsOwed(),
    ]);
    expect(s.personal.bids).toHaveBeenCalledTimes(1);
    expect(s.personal.purchases).toHaveBeenCalledTimes(1);
    expect(s.personal.amountsOwed).toHaveBeenCalledTimes(1);
    expect(s.organisation.amountsOwed).not.toHaveBeenCalled();
    expect(s.organisation.bids).not.toHaveBeenCalled();
  });
});

describe("buyingPageView", () => {
  it.each([
    ["owner", "open", "open"],
    ["admin", "open", "open"],
    ["buyer_agent", "open", "open"],
    ["finance", "forbidden", "open"],
    ["consignor", "forbidden", "forbidden"],
    ["viewer", "forbidden", "forbidden"],
  ] as const)("%s: Bids %s, Purchases %s", (role, bids, purchases) => {
    expect(buyingPageView(organisation(role), "bids").kind).toBe(bids);
    expect(buyingPageView(organisation(role), "purchases").kind).toBe(purchases);
  });

  it.each([
    ["owner", true],
    ["buyer_agent", true],
    ["finance", false],
  ] as const)("points %s to the sales from an empty Purchases: %s", (role, offersSales) => {
    expect(buyingPageView(organisation(role), "purchases")).toMatchObject({ offersSales });
  });

  it("points a personal account to the sales", () => {
    expect(buyingPageView(personal, "purchases")).toMatchObject({ offersSales: true });
  });

  it("names the page and who can open it", () => {
    expect(buyingPageView(organisation("viewer"), "purchases")).toEqual({
      kind: "forbidden",
      label: "Purchases",
      openedBy: expect.stringMatching(/^Owners, admins, finance and buyer agents$/),
    });
  });

  it("keeps the personal titles and names the organisation inside it", () => {
    expect(buyingPageView(personal, "bids")).toMatchObject({ title: "My bids" });
    expect(buyingPageView(organisation("owner"), "bids")).toMatchObject({
      title: "Bids",
      description:
        "Bids placed for Northbank Gallery in current and past sales. Prices update live.",
    });
    expect(buyingPageView(organisation("buyer_agent"), "purchases")).toMatchObject({
      description: "Lots you have won for Northbank Gallery, from payment to delivery.",
    });
  });
});
