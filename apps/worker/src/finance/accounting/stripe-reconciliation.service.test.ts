import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type SwitchConfig, ok } from "@auction/accounting-domain";
import type {
  ClearingMovements,
  DayKindTotals,
  IStripeReconciliationStore,
  ParkedBalanceTransaction,
  PayoutKindTotals,
  StripeAccountState,
  UnbookedMovement,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { FakeStripeBalance } from "../../testing/fake-stripe-balance.js";
import { ACCOUNTING_ALERTS } from "./accounting-alerts.js";
import type { StripeBalanceReader } from "./stripe-balance-reader.js";
import {
  KNOWN_UNBOOKED_TYPES,
  StripeReconciliation,
  previousLondonDay,
  reconciliationKey,
} from "./stripe-reconciliation.service.js";

const DOCUMENTED_UNBOOKED_TYPES = [
  "transfer",
  "transfer_cancel",
  "transfer_refund",
  "transfer_failure",
  "refund",
  "payment_refund",
  "adjustment",
];

describe("KNOWN_UNBOOKED_TYPES", () => {
  it("is exactly the types the runbook documents", () => {
    expect([...KNOWN_UNBOOKED_TYPES].sort()).toEqual([...DOCUMENTED_UNBOOKED_TYPES].sort());
    const runbook = readFileSync(
      fileURLToPath(new URL("../../../../../docs/runbooks/monitoring-alerts.md", import.meta.url)),
      "utf8",
    );
    for (const type of DOCUMENTED_UNBOOKED_TYPES) expect(runbook).toContain(`\`${type}\``);
  });
});

const NOW = new Date("2031-11-14T05:30:00Z");
/** Where this morning's read stopped: now less the settle time. */
const READ_THROUGH = new Date("2031-11-14T05:20:00Z");
const config: SwitchConfig = {
  bid: { xero: "live", books: "off" },
  shop: { xero: "off", books: "dry_run" },
  lax_art: { xero: "off", books: "off" },
};

const agreeing: DayKindTotals[] = [
  {
    kind: "payment",
    laxPence: 10_000,
    laxCount: 1,
    booksPence: 10_000,
    booksCount: 1,
    notIssuedCount: 0,
    notIssuedPence: 0,
  },
  {
    kind: "expense",
    laxPence: 165,
    laxCount: 1,
    booksPence: 165,
    booksCount: 1,
    notIssuedCount: 0,
    notIssuedPence: 0,
  },
  {
    kind: "transfer",
    laxPence: 0,
    laxCount: 0,
    booksPence: 0,
    booksCount: 0,
    notIssuedCount: 0,
    notIssuedPence: 0,
  },
];

function store(
  over: Partial<{
    totals: DayKindTotals[];
    parked: ParkedBalanceTransaction[];
    accounts: StripeAccountState[];
    clearing: ClearingMovements;
    unbooked: UnbookedMovement[];
    held: number | null;
    payouts: PayoutKindTotals[];
  }> = {},
) {
  const saved: unknown[] = [];
  const s: IStripeReconciliationStore = {
    dayTotals: async () => over.totals ?? agreeing,
    parkedOn: async () => over.parked ?? [],
    openings: async () =>
      over.accounts ?? [
        {
          stripeAccountId: "acct_1Shop",
          product: "shop",
          readThrough: READ_THROUGH,
          opening: { balancePence: 1_000, on: "2031-11-01" },
        },
      ],
    clearingSince: vi.fn(
      async () =>
        over.clearing ?? {
          paymentsPence: 10_000,
          expensesPence: 165,
          transfersPence: 0,
          billPaymentsPence: 0,
          billPaymentsNotIssuedPence: 0,
          notIssuedPence: 0,
        },
    ),
    knownUnbooked: async () => over.unbooked ?? [],
    heldTransferPence: async () => (over.held === undefined ? null : over.held),
    payoutTotals: async () => over.payouts ?? [],
    saveReport: async (input) => void saved.push(input),
  };
  return { s, saved };
}

function run(
  st: IStripeReconciliationStore,
  balance: number,
  readers: StripeBalanceReader[] = [new FakeStripeBalance("acct_1Shop", balance)],
) {
  const raised: { alert: unknown; fields: unknown }[] = [];
  const putObject = vi.fn(async () => ({}));
  const service = new StripeReconciliation({
    store: st,
    settings: { read: async () => ok(config) } as never,
    readers,
    storage: { putObject },
    alerts: { raise: (alert, fields) => void raised.push({ alert, fields }) },
    now: () => NOW,
    log: { info: vi.fn(), warn: vi.fn() },
  });
  return { service, raised, putObject };
}

/** One payout kind's totals for the day; everything agrees unless a test says otherwise. */
const payoutRow = (over: Partial<PayoutKindTotals> = {}): PayoutKindTotals => ({
  kind: "bill",
  laxPence: 0,
  laxCount: 0,
  booksPence: 0,
  booksCount: 0,
  notIssuedPence: 0,
  notIssuedCount: 0,
  parkedPence: 0,
  parkedCount: 0,
  unmatchedCount: 0,
  ...over,
});

describe("StripeReconciliation: payouts against the payout ledger", () => {
  it("is quiet when each payout's bill and payment are issued, on their way or parked to the penny", async () => {
    const { s } = store({
      payouts: [
        payoutRow({
          laxPence: 104_048,
          laxCount: 2,
          booksPence: 82_000,
          booksCount: 1,
          parkedPence: 22_048,
          parkedCount: 1,
        }),
        payoutRow({
          kind: "bill_payment",
          laxPence: 82_000,
          laxCount: 1,
          notIssuedPence: 82_000,
          notIssuedCount: 1,
        }),
      ],
    });
    const { service, raised } = run(s, 1_000 + 10_000 - 165);
    const [report] = await service.run();
    expect(report?.payouts.map((p) => [p.kind, p.differencePence])).toEqual([
      ["bill", 0],
      ["bill_payment", 0],
    ]);
    expect(report?.mismatches).toBe(0);
    expect(raised).toEqual([]);
  });

  it("alerts on a payout with no bill, or a bill for another amount than the ledger owes", async () => {
    for (const row of [
      payoutRow({ laxPence: 104_048, laxCount: 1, unmatchedCount: 1 }),
      payoutRow({
        laxPence: 104_048,
        laxCount: 1,
        booksPence: 104_047,
        booksCount: 1,
        unmatchedCount: 1,
      }),
    ]) {
      const { s } = store({ payouts: [row] });
      const { service, raised } = run(s, 1_000 + 10_000 - 165);
      const [report] = await service.run();
      expect(report?.mismatches).toBe(1);
      expect(raised).toHaveLength(1);
    }
  });

  it("counts a payout paid by Stripe transfer once: booked as its payment, not also as a known transfer", async () => {
    // The seller's 820.00 left Stripe as a transfer and is booked as the payout's payment.
    const { s } = store({
      clearing: {
        paymentsPence: 100_000,
        expensesPence: 0,
        transfersPence: 0,
        billPaymentsPence: 82_000,
        billPaymentsNotIssuedPence: 0,
        notIssuedPence: 0,
      },
      unbooked: [{ type: "transfer", pence: -82_000 }],
    });
    const { service, raised } = run(s, 1_000 + 100_000 - 82_000);
    const [report] = await service.run();
    expect(report?.clearing).toMatchObject({
      booksPayoutPaymentsPence: 82_000,
      transfersBookedAsPayoutPaymentsPence: 82_000,
      knownUnbookedPence: 0,
      unexplainedPence: 0,
    });
    expect(raised).toEqual([]);
  });
});

describe("StripeReconciliation", () => {
  it("reports yesterday, only for companies aimed at Books, and stays quiet when everything agrees", async () => {
    const { s, saved } = store();
    // Opening 10.00, payments in 100.00, a fee 1.65 out: Stripe should hold 108.35.
    const { service, raised, putObject } = run(s, 1_000 + 10_000 - 165);
    const reports = await service.run();
    expect(reports.map((r) => [r.legalEntity, r.day])).toEqual([
      ["london_art_exchange", "2031-11-13"],
    ]);
    expect(reports[0]?.clearing).toMatchObject({
      reconcilable: true,
      booksClearingPence: 10_835,
      stripeBalancePence: 10_835,
      unexplainedPence: 0,
    });
    expect(reports[0]?.mismatches).toBe(0);
    expect(raised).toEqual([]);
    expect(putObject).toHaveBeenCalledOnce();
    expect(saved).toEqual([
      expect.objectContaining({ entity: "london_art_exchange", day: "2031-11-13", mismatches: 0 }),
    ]);
  });

  it("counts documents still on their way to Books as in flight, not as a difference", async () => {
    const { s } = store({
      clearing: {
        paymentsPence: 10_000,
        expensesPence: 0,
        transfersPence: 0,
        billPaymentsPence: 0,
        billPaymentsNotIssuedPence: 0,
        notIssuedPence: -165,
      },
    });
    const { service, raised } = run(s, 1_000 + 10_000 - 165);
    const [report] = await service.run();
    expect(report?.clearing).toMatchObject({ inFlightPence: -165, unexplainedPence: 0 });
    expect(raised).toEqual([]);
  });

  it("takes a seller transfer no Books flow books out of clearing, and still shows it", async () => {
    const { s } = store({ unbooked: [{ type: "transfer", pence: -8_000 }] });
    // A seller was paid 80.00 from the balance by a Connect transfer.
    const { service, raised } = run(s, 1_000 + 10_000 - 165 - 8_000);
    const [report] = await service.run();
    expect(report?.clearing).toMatchObject({
      knownUnbooked: [{ type: "transfer", pence: -8_000 }],
      knownUnbookedPence: -8_000,
      unexplainedPence: 0,
    });
    expect(raised).toEqual([]);
  });

  it("still alerts when a seller transfer is known but a payout is missing from Books", async () => {
    const { s } = store({ unbooked: [{ type: "transfer", pence: -8_000 }] });
    // The transfer is explained; a 40.00 payout also left the balance and Books never booked it.
    const { service, raised } = run(s, 1_000 + 10_000 - 165 - 8_000 - 4_000);
    const [report] = await service.run();
    expect(report?.clearing).toMatchObject({
      knownUnbookedPence: -8_000,
      unexplainedPence: -4_000,
    });
    expect(report?.mismatches).toBe(1);
    expect(raised).toEqual([
      {
        alert: ACCOUNTING_ALERTS.reconciliationMismatch,
        fields: expect.objectContaining({ legalEntity: "london_art_exchange", mismatches: 1 }),
      },
    ]);
  });

  it.each(DOCUMENTED_UNBOOKED_TYPES)(
    "takes a documented %s movement out of clearing without an alert",
    async (type) => {
      const { s } = store({ unbooked: [{ type, pence: -500 }] });
      const { service, raised } = run(s, 1_000 + 10_000 - 165 - 500);
      const [report] = await service.run();
      expect(report?.clearing).toMatchObject({ knownUnbookedPence: -500, unexplainedPence: 0 });
      expect(raised).toEqual([]);
    },
  );

  it.each(["payout", "stripe_fee", "network_cost", "anything_new"])(
    "does not treat a %s movement as known unbooked: it is a difference and alerts",
    async (type) => {
      const { s } = store({ unbooked: [{ type, pence: -500 }] });
      const { service, raised } = run(s, 1_000 + 10_000 - 165 - 500);
      const [report] = await service.run();
      expect(report?.clearing).toMatchObject({
        knownUnbooked: [],
        knownUnbookedPence: 0,
        unexplainedPence: -500,
      });
      expect(report?.mismatches).toBe(1);
      expect(raised).toHaveLength(1);
    },
  );

  it("shows a document still on its way to Books by type, without counting it as a mismatch", async () => {
    const { s } = store({
      totals: agreeing.map((t) =>
        t.kind === "payment"
          ? { ...t, booksPence: 0, booksCount: 0, notIssuedPence: 10_000, notIssuedCount: 1 }
          : t,
      ),
    });
    const { service, raised } = run(s, 10_835);
    const [report] = await service.run();
    expect(report?.byType.find((t) => t.kind === "payment")).toMatchObject({
      notIssuedCount: 1,
      notIssuedPence: 10_000,
      differencePence: 0,
    });
    expect(report?.mismatches).toBe(0);
    expect(raised).toEqual([]);
  });

  it("alerts when clearing and Stripe disagree by a penny", async () => {
    const { s } = store();
    const { service, raised } = run(s, 1_000 + 10_000 - 165 + 1);
    const [report] = await service.run();
    expect(report?.clearing.unexplainedPence).toBe(1);
    expect(report?.mismatches).toBe(1);
    expect(raised).toEqual([
      {
        alert: ACCOUNTING_ALERTS.reconciliationMismatch,
        fields: expect.objectContaining({ legalEntity: "london_art_exchange", mismatches: 1 }),
      },
    ]);
  });

  it("alerts on a type whose totals differ, and on each transaction parked for a person", async () => {
    const parked: ParkedBalanceTransaction = {
      stripeAccountId: "acct_1Shop",
      balanceTransactionId: "txn_1",
      type: "charge",
      reason: "unattributable",
      amountPence: 1_000,
      feePence: 20,
    };
    const { s } = store({
      totals: agreeing.map((t) => (t.kind === "expense" ? { ...t, booksPence: 164 } : t)),
      parked: [parked],
    });
    const { service, raised } = run(s, 10_835);
    const [report] = await service.run();
    expect(report?.byType.find((t) => t.kind === "expense")?.differencePence).toBe(1);
    expect(report?.mismatches).toBe(2);
    expect(raised).toHaveLength(1);
  });

  it("does not compare clearing until every account has its opening, and alerts that it was not read", async () => {
    const { s } = store({
      accounts: [
        { stripeAccountId: "acct_1Shop", product: "shop", readThrough: null, opening: null },
      ],
    });
    const { service, raised } = run(s, 123_456);
    const [report] = await service.run();
    expect(report?.clearing).toMatchObject({ reconcilable: false, unexplainedPence: null });
    expect(s.clearingSince).not.toHaveBeenCalled();
    expect(report).toMatchObject({
      complete: false,
      accountsNotRead: [{ stripeAccountId: "acct_1Shop", reason: "no_opening" }],
      mismatches: 1,
    });
    expect(raised).toHaveLength(1);
  });

  it("alerts when a registered account has no key, a key reads another account, or the read stopped", async () => {
    const { s } = store({
      accounts: [
        {
          stripeAccountId: "acct_1Shop",
          product: "shop",
          readThrough: READ_THROUGH,
          opening: { balancePence: 0, on: "2031-11-01" },
        },
        {
          stripeAccountId: "acct_2Shop",
          product: "shop",
          readThrough: new Date("2031-11-13T12:00:00Z"),
          opening: { balancePence: 0, on: "2031-11-01" },
        },
      ],
    });
    const failing = new FakeStripeBalance("acct_3Gone");
    failing.balancePence = async () => Promise.reject(new Error("api_key_expired"));
    const { service, raised } = run(s, 0, [
      new FakeStripeBalance("acct_2Shop", 0),
      new FakeStripeBalance("acct_9Other", 0),
      failing,
    ]);
    const [report] = await service.run();
    expect(report?.accountsNotRead).toEqual([
      { stripeAccountId: "acct_1Shop", reason: "balance_not_read" },
      { stripeAccountId: "acct_2Shop", reason: "not_read_through" },
      { stripeAccountId: "acct_9Other", reason: "not_registered" },
    ]);
    expect(report).toMatchObject({ complete: false, mismatches: 3 });
    expect(report?.clearing.unexplainedPence).toBeNull();
    expect(raised).toHaveLength(1);
  });

  it("stores ids and amounts only, under the private reconciliation prefix", async () => {
    const { s } = store({ held: 42 });
    const { service, putObject } = run(s, 10_835);
    await service.run();
    const [key, body, type] = putObject.mock.calls[0] as unknown as [string, Buffer, string];
    expect(key).toBe(reconciliationKey("london_art_exchange", "2031-11-13", NOW));
    expect(key).toMatch(
      /^accounting\/reconciliation\/london_art_exchange\/2031-11-13\/[A-Za-z0-9._-]+\.json$/,
    );
    expect(type).toBe("application/json");
    const json = JSON.parse(body.toString("utf8"));
    expect(json).toMatchObject({ version: 1, rehearsal: true, heldTransferPence: 42 });
    expect(Object.keys(json).sort()).toEqual([
      "accountsNotRead",
      "byType",
      "clearing",
      "complete",
      "day",
      "generatedAt",
      "heldTransferPence",
      "legalEntity",
      "mismatches",
      "parked",
      "payouts",
      "rehearsal",
      "target",
      "version",
    ]);
  });

  it("reports the London day before, across the clock change", () => {
    expect(previousLondonDay(new Date("2031-03-30T04:30:00Z"))).toBe("2031-03-29");
    // 23:30 UTC on 30 March is 00:30 on the 31st in London (summer time).
    expect(previousLondonDay(new Date("2031-03-30T23:30:00Z"))).toBe("2031-03-30");
    expect(previousLondonDay(new Date("2031-10-26T23:30:00Z"))).toBe("2031-10-25");
  });
});
