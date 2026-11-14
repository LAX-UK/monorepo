import {
  type Expense,
  type Transfer,
  buildExpense,
  buildTransfer,
  expectedTotals,
} from "@auction/accounting-domain";
import { describe, expect, it } from "vitest";
import {
  InMemoryAccounting,
  SHOP_ORG_ID,
  createAdapterHarness,
  rawOrgSettings,
  testOrgConfigs,
} from "../testing/index.js";
import { DRY_RUN_NUMBER, createZohoBooksDryRunAdapter, dryRunProviderId } from "./dry-run.js";
import { ZOHO_BOOKS_REJECTIONS as R } from "./index.js";
import { expenseBody, transferBody } from "./mappers/movement.js";
import { parseOrgConfigs } from "./org-config.js";

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; refusal: { code: string } }): T => {
  if (!r.ok) throw new Error(r.refusal.code);
  return r.value;
};

const fee = (product: "shop" | "bid" = "shop", amountPence = 165): Expense =>
  unwrap(
    buildExpense({
      product,
      sourceId: "txn_1-ab-c",
      category: "stripe_fees",
      spentOn: "2026-11-13",
      amountPence,
      description: "Stripe fees txn_1AbC (charge)",
    }),
  );

const payout = (product: "shop" | "bid" = "shop", amountPence = 98_765): Transfer =>
  unwrap(
    buildTransfer({
      product,
      sourceId: "po_1-xy",
      transferredOn: "2026-11-13",
      amountPence,
      description: "Stripe payout po_1Xy",
    }),
  );

/** Shop's settings without the Stripe accounts, as before the accountant names them. */
function withoutStripe() {
  const raw = rawOrgSettings() as Record<string, Record<string, unknown>>;
  const { stripe: _stripe, ...shop } = raw.london_art_exchange as Record<string, unknown>;
  return parseOrgConfigs({ london_art_exchange: shop });
}

describe("Stripe fees and payouts: mappers", () => {
  const shop = testOrgConfigs().london_art_exchange;
  if (!shop?.stripe) throw new Error("fixture has Stripe accounts");

  it("books a fee as an expense to the fees account, paid through the clearing account, in pounds", () => {
    expect(unwrap(expenseBody(fee("shop", 165), shop))).toEqual({
      account_id: shop.stripe?.feesAccountId,
      paid_through_account_id: shop.payments.depositAccountId,
      date: "2026-11-13",
      amount: 1.65,
      currency_code: "GBP",
      is_inclusive_tax: false,
      reference_number: "LAX-SHOP-EXP-txn_1-ab-c",
      description: "Stripe fees txn_1AbC (charge)",
      custom_fields: [
        { customfield_id: shop.laxReferenceField.fieldId, value: "LAX-SHOP-EXP-txn_1-ab-c" },
      ],
    });
  });

  it("books a payout as a transfer from the clearing account to the bank", () => {
    const body = unwrap(transferBody(payout("shop", 98_765), shop));
    expect(body).toMatchObject({
      transaction_type: "transfer_fund",
      from_account_id: shop.payments.depositAccountId,
      to_account_id: shop.stripe?.bankAccountId,
      amount: 987.65,
      reference_number: "LAX-SHOP-TRF-po_1-xy",
    });
    expect(JSON.stringify(body)).not.toMatch(/tax/);
  });

  it("refuses both while the organisation has no Stripe accounts configured", () => {
    const org = withoutStripe().london_art_exchange;
    if (!org) throw new Error("fixture");
    expect(expenseBody(fee(), org)).toMatchObject({
      ok: false,
      refusal: { code: "stripe_accounts_missing" },
    });
    expect(transferBody(payout(), org)).toMatchObject({ ok: false });
  });

  it("refuses Stripe accounts that are not Books ids at start-up", () => {
    const raw = rawOrgSettings() as Record<string, Record<string, unknown>>;
    const shopRaw = {
      ...raw.london_art_exchange,
      stripe: { feesAccountId: "x", bankAccountId: "1" },
    };
    expect(() => parseOrgConfigs({ london_art_exchange: shopRaw })).toThrow(
      /org_london_art_exchange_stripe_fees_account_invalid/,
    );
  });
});

describe("Stripe fees and payouts: dry run", () => {
  const ports = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() });

  it("rehearses each with our own totals and a rehearsal identity", async () => {
    for (const [doc, send] of [
      [fee(), () => ports.expenses.recordExpense(fee())],
      [payout("bid"), () => ports.transfers.recordTransfer(payout("bid"))],
    ] as const) {
      expect(await send()).toEqual({
        status: "issued",
        number: DRY_RUN_NUMBER,
        providerId: dryRunProviderId(doc.reference),
        pdfRef: null,
        totals: expectedTotals(doc),
      });
    }
  });

  it("refuses, as Books would, while the Stripe accounts are not configured", async () => {
    const bare = createZohoBooksDryRunAdapter({ orgs: withoutStripe() });
    expect(await bare.expenses.recordExpense(fee())).toEqual({
      status: "rejected",
      reason: R.stripeAccountsMissing,
    });
    expect(await bare.transfers.recordTransfer(payout())).toEqual({
      status: "rejected",
      reason: R.stripeAccountsMissing,
    });
  });
});

describe("Stripe fees and payouts: Books adapter over the simulator", () => {
  it("sends each once under its LAX reference, and adopts a repeat as the same document", async () => {
    const h = await createAdapterHarness({
      writes: { mode: "test_org", organizationIds: [SHOP_ORG_ID] },
    });
    const first = await h.settle(h.ports.expenses.recordExpense(fee()));
    expect(first).toMatchObject({ status: "issued", totals: expectedTotals(fee()) });
    const again = await h.settle(h.ports.expenses.recordExpense(fee()));
    expect(again).toMatchObject({
      status: "issued",
      providerId: first.status === "issued" ? first.providerId : "",
    });
    expect(h.books.stored("london_art_exchange", "expense")).toHaveLength(1);
    const moved = await h.settle(h.ports.transfers.recordTransfer(payout()));
    expect(moved).toMatchObject({ status: "issued", totals: expectedTotals(payout()) });
    expect(h.books.stored("london_art_exchange", "transfer")).toHaveLength(1);
    expect(await h.settle(h.ports.lookup.findDocument(payout()))).toMatchObject({
      status: "found",
    });
  });

  it("reads a payout held under our reference with another amount back as differing", async () => {
    const h = await createAdapterHarness({
      writes: { mode: "test_org", organizationIds: [SHOP_ORG_ID] },
    });
    await h.settle(h.ports.transfers.recordTransfer(payout("shop", 100)));
    expect(await h.settle(h.ports.transfers.recordTransfer(payout("shop", 101)))).toMatchObject({
      status: "differs",
      reason: R.movementMismatch,
    });
    expect(await h.settle(h.ports.lookup.findDocument(payout("shop", 101)))).toMatchObject({
      status: "differs",
    });
  });

  it("writes nothing in dry-run mode", async () => {
    const h = await createAdapterHarness({ writes: { mode: "dry_run" } });
    expect(await h.settle(h.ports.expenses.recordExpense(fee()))).toEqual({
      status: "rejected",
      reason: R.writesDisabled,
    });
    expect(h.books.requests).toHaveLength(0);
  });
});

describe("Stripe fees and payouts: the in-memory fake", () => {
  it("holds one per reference and says a resend with another amount differs", async () => {
    const fake = new InMemoryAccounting();
    expect((await fake.expenses.recordExpense(fee("bid", 10))).status).toBe("issued");
    expect((await fake.expenses.recordExpense(fee("bid", 10))).status).toBe("issued");
    expect((await fake.expenses.recordExpense(fee("bid", 11))).status).toBe("differs");
    expect((await fake.lookup.findDocument(fee("bid", 10))).status).toBe("found");
  });
});
