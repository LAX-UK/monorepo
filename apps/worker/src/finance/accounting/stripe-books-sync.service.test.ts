import { type Product, type SwitchConfig, ok } from "@auction/accounting-domain";
import type {
  IStripeBooksLedger,
  StripeAccountState,
  StripeBalanceOutcome,
  StripeBalanceRow,
  StripeChargeRefs,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { FakeStripeBalance, stripeTxn } from "../../testing/fake-stripe-balance.js";
import { sourceOf } from "./stripe-balance-reader.js";
import { StripeBooksSync, londonDay, startOfLondonDay } from "./stripe-books-sync.service.js";

const NOON = Date.UTC(2031, 10, 13, 12) / 1000;
const NOW = new Date(Date.UTC(2031, 10, 14, 5, 30));

/** The ledger in memory: what each transaction was decided as, and the charges LAX holds. */
class MemoryLedger implements IStripeBooksLedger {
  readonly recorded = new Map<string, { row: StripeBalanceRow; outcome: StripeBalanceOutcome }>();
  readonly lookups: StripeChargeRefs[] = [];
  cursor: Date | null = null;
  constructor(
    private readonly account: StripeAccountState,
    private readonly charges: ReadonlyMap<string, readonly Product[]> = new Map(),
  ) {}
  async accounts() {
    return [{ ...this.account, readThrough: this.cursor }];
  }
  async productsForCharge(refs: StripeChargeRefs) {
    this.lookups.push(refs);
    return [
      ...(this.charges.get(refs.paymentIntentId ?? "") ?? []),
      ...(this.charges.get(refs.chargeId ?? "") ?? []),
    ];
  }
  async record(row: StripeBalanceRow, outcome: StripeBalanceOutcome) {
    if (this.recorded.has(row.id)) return "already_recorded" as const;
    this.recorded.set(row.id, { row, outcome });
    return "recorded" as const;
  }
  async advanceCursor(_id: string, readThrough: Date) {
    if (!this.cursor || readThrough > this.cursor) this.cursor = readThrough;
  }
}

const aimed: SwitchConfig = {
  bid: { xero: "off", books: "dry_run" },
  shop: { xero: "off", books: "dry_run" },
  lax_art: { xero: "off", books: "off" },
};

function setUp(
  product: Product,
  charges: ReadonlyMap<string, readonly Product[]> = new Map(),
  config: SwitchConfig = aimed,
) {
  const ledger = new MemoryLedger(
    {
      stripeAccountId: "acct_1Test",
      product,
      readThrough: null,
      opening: { balancePence: 0, on: "2031-11-13" },
    },
    charges,
  );
  const stripe = new FakeStripeBalance("acct_1Test");
  const log = { info: vi.fn(), warn: vi.fn() };
  const sync = new StripeBooksSync({
    ledger,
    settings: { read: async () => ok(config) } as never,
    readers: [stripe],
    now: () => NOW,
    log,
    pageSize: 2,
  });
  return { ledger, stripe, sync, log };
}

const chargeWith = (id: string, paymentIntentId: string | null, fee = 150) =>
  stripeTxn({
    id,
    fee,
    created: NOON,
    source: { id: `ch_${id}`, chargeId: `ch_${id}`, paymentIntentId },
  });

const outcomeOf = (ledger: MemoryLedger, id: string) => ledger.recorded.get(id)?.outcome;

describe("StripeBooksSync attribution (stored rows only)", () => {
  it("books a charge's fee for the product whose stored row holds its PaymentIntent", async () => {
    const { ledger, stripe, sync } = setUp("shop", new Map([["pi_shop", ["shop"]]]));
    stripe.add(chargeWith("txn_1", "pi_shop"));
    await sync.run();
    expect(outcomeOf(ledger, "txn_1")).toMatchObject({
      outcome: "booked",
      product: "shop",
      feePence: 150,
    });
  });

  it("parks a charge no stored row holds, and never falls back to the account's product", async () => {
    const { ledger, stripe, sync } = setUp("shop");
    stripe.add(
      chargeWith("txn_1", "pi_unknown"),
      stripeTxn({ id: "txn_2", created: NOON, source: null }),
    );
    await sync.run();
    expect(outcomeOf(ledger, "txn_1")).toEqual({
      outcome: "parked",
      product: null,
      reason: "unattributable",
    });
    expect(outcomeOf(ledger, "txn_2")).toEqual({
      outcome: "parked",
      product: null,
      reason: "unattributable",
    });
  });

  it("parks a charge two companies' rows hold, or one company's charge in the other's account", async () => {
    const { ledger, stripe, sync } = setUp(
      "bid",
      new Map<string, readonly Product[]>([
        ["pi_both", ["bid", "shop"]],
        ["pi_shop", ["shop"]],
      ]),
    );
    stripe.add(chargeWith("txn_1", "pi_both"), chargeWith("txn_2", "pi_shop"));
    await sync.run();
    expect(outcomeOf(ledger, "txn_1")).toMatchObject({
      outcome: "parked",
      reason: "attribution_conflict",
    });
    expect(outcomeOf(ledger, "txn_2")).toMatchObject({
      outcome: "parked",
      reason: "attribution_conflict",
    });
  });

  it("books a Shop charge in a lax.art account: one company, one Books organisation", async () => {
    const { ledger, stripe, sync } = setUp("lax_art", new Map([["pi_shop", ["shop"]]]));
    stripe.add(chargeWith("txn_1", "pi_shop"));
    await sync.run();
    expect(outcomeOf(ledger, "txn_1")).toMatchObject({ outcome: "booked", product: "shop" });
  });

  it("takes a payout's and Stripe's own fee's company from the account's stored row", async () => {
    const { ledger, stripe, sync } = setUp("bid");
    stripe.add(
      stripeTxn({
        id: "txn_1",
        type: "payout",
        amount: -5_000,
        fee: 0,
        created: NOON,
        source: { id: "po_1", chargeId: null, paymentIntentId: null },
      }),
      stripeTxn({
        id: "txn_2",
        type: "stripe_fee",
        amount: -499,
        fee: 0,
        created: NOON + 1,
        source: null,
      }),
    );
    await sync.run();
    expect(outcomeOf(ledger, "txn_1")).toMatchObject({
      outcome: "booked",
      product: "bid",
      payoutPence: 5_000,
    });
    expect(outcomeOf(ledger, "txn_2")).toMatchObject({
      outcome: "booked",
      product: "bid",
      feePence: 499,
    });
    expect(ledger.recorded.get("txn_1")?.row.payoutId).toBe("po_1");
    expect(ledger.lookups).toEqual([]);
  });

  it("looks nothing up for a transaction with nothing to book", async () => {
    const { ledger, stripe, sync } = setUp("shop");
    stripe.add(chargeWith("txn_1", "pi_x", 0));
    await sync.run();
    expect(outcomeOf(ledger, "txn_1")).toEqual({ outcome: "nothing", product: null });
    expect(ledger.lookups).toEqual([]);
  });

  it("records but does not book while Books is not aimed at the product", async () => {
    const { ledger, stripe, sync } = setUp("shop", new Map([["pi_art", ["lax_art"]]]));
    stripe.add(chargeWith("txn_1", "pi_art"));
    await sync.run();
    expect(outcomeOf(ledger, "txn_1")).toEqual({ outcome: "not_aimed", product: "lax_art" });
  });

  it("reads no account that has no LAX row, and none whose start is not stated", async () => {
    const { ledger, sync, log } = setUp("shop");
    const other = new FakeStripeBalance("acct_1Other").add(chargeWith("txn_1", "pi_x"));
    const s = new StripeBooksSync({
      ledger,
      settings: { read: async () => ok(aimed) } as never,
      readers: [other],
      now: () => NOW,
      log,
    });
    await s.run();
    expect(other.calls).toEqual([]);
    expect(log.warn).toHaveBeenCalledWith(
      { stripeAccountId: "acct_1Other" },
      "accounting_stripe_account_not_registered",
    );
    expect(ledger.recorded.size).toBe(0);
    void sync;
  });
});

describe("StripeBooksSync paging and cursor", () => {
  it("walks every page newest first, records oldest first, and moves the cursor to now less the settle time", async () => {
    const { ledger, stripe, sync } = setUp("shop", new Map([["pi", ["shop"]]]));
    for (let n = 1; n <= 5; n += 1) stripe.add(chargeWith(`txn_${n}`, "pi", n));
    const summary = await sync.run();
    // Two windows of at most a day: the 13th (three pages of two) and the 14th until 05:20 (empty).
    expect(summary).toMatchObject({ read: 5, recorded: 5, pages: 4 });
    expect([...ledger.recorded.keys()]).toEqual(["txn_1", "txn_2", "txn_3", "txn_4", "txn_5"]);
    expect(stripe.calls.map((c) => c.startingAfter)).toEqual([
      undefined,
      "txn_4",
      "txn_2",
      undefined,
    ]);
    expect(ledger.cursor?.getTime()).toBe(NOW.getTime() - 10 * 60_000);
  });

  it("keeps the cursor before a window it could not finish", async () => {
    const { ledger, stripe, sync } = setUp("shop", new Map([["pi", ["shop"]]]));
    for (let n = 1; n <= 5; n += 1) stripe.add(chargeWith(`txn_${n}`, "pi", n));
    stripe.failAfterPages(1);
    await expect(sync.run()).rejects.toThrow();
    expect(ledger.cursor).toBeNull();
    expect(ledger.recorded.size).toBe(0);
  });
});

describe("London days", () => {
  it("dates a transaction by its London calendar day, in winter and in summer", () => {
    expect(londonDay(new Date("2031-11-13T23:30:00Z"))).toBe("2031-11-13");
    expect(londonDay(new Date("2031-07-13T23:30:00Z"))).toBe("2031-07-14");
    expect(startOfLondonDay("2031-07-14").toISOString()).toBe("2031-07-13T23:00:00.000Z");
    expect(startOfLondonDay("2031-11-14").toISOString()).toBe("2031-11-14T00:00:00.000Z");
  });
});

describe("sourceOf", () => {
  it("reads the charge and PaymentIntent behind a charge, a refund and a dispute", () => {
    expect(sourceOf({ id: "ch_1", object: "charge", payment_intent: "pi_1" })).toEqual({
      id: "ch_1",
      chargeId: "ch_1",
      paymentIntentId: "pi_1",
    });
    expect(
      sourceOf({ id: "re_1", object: "refund", charge: "ch_1", payment_intent: { id: "pi_1" } }),
    ).toEqual({
      id: "re_1",
      chargeId: "ch_1",
      paymentIntentId: "pi_1",
    });
    expect(sourceOf({ id: "dp_1", object: "dispute", charge: { id: "ch_1" } })).toEqual({
      id: "dp_1",
      chargeId: "ch_1",
      paymentIntentId: null,
    });
    expect(sourceOf("po_1")).toEqual({ id: "po_1", chargeId: null, paymentIntentId: null });
    expect(sourceOf(null)).toBeNull();
  });
});
