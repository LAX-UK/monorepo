import {
  type DealClearanceSnapshot,
  type PrivateSalePolicy,
  resolvePrivateSalePolicy,
} from "@auction/domain";
import type {
  PrivateSaleDealDetail,
  PrivateSaleDealStage,
  PrivateSaleStageChange,
} from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { PrivateSaleDealCommandService } from "./deal-command.service.js";
import { PrivateSaleDealDesk } from "./deal-desk.js";
import {
  InMemoryDealPayments,
  makeDeal,
  makePayment,
  recordingSink,
} from "./deal-fixtures.test-util.js";
import { PrivateSaleDealQueryService } from "./deal-query.service.js";
import type { DealStaffViewer } from "./deal-staff-permissions.js";
import { DealTransitionService } from "./deal-transition.service.js";

const CLEAR: DealClearanceSnapshot = {
  seller: { kyc: "clear", aml: "clear" },
  buyer: { kyc: "clear", aml: "clear" },
  buyerSourceOfFunds: "approved",
  buyerOtherOpenExposureMinor: 0,
};

const CONFIGURED = resolvePrivateSalePolicy({
  commissionRateBps: 1500,
  vatTreatments: [{ code: "margin_scheme", label: "Margin scheme" }],
  termsVersion: "v1",
  paymentDueDays: 7,
});

const staff = (
  abilities: Partial<DealStaffViewer["abilities"]>,
  userId = "u-staff",
  extra: Partial<Pick<DealStaffViewer, "checks" | "scope">> = {},
): DealStaffViewer => ({
  userId,
  abilities: { manage: false, finance: false, release: false, ...abilities },
  checks: true,
  scope: { kind: "all" },
  ...extra,
});

const MANAGER = staff({ manage: true });
const FINANCE = staff({ finance: true }, "u-finance");

type Setup = {
  deal?: PrivateSaleDealDetail;
  policy?: PrivateSalePolicy;
  clearance?: DealClearanceSnapshot;
  payments?: InMemoryDealPayments;
  partyResolves?: { legalEntityId: string; actingUserId: string } | null;
  hasPayoutLine?: boolean;
};

function setup(options: Setup = {}) {
  let deal =
    options.deal ?? makeDeal({ stage: "offer", priceMinor: 4_800_000, vatTreatment: null });
  const events = recordingSink();
  const payments = options.payments ?? new InMemoryDealPayments();
  const policy = options.policy ?? CONFIGURED;
  const clearance = options.clearance ?? CLEAR;

  const applyStageChange = vi.fn(
    async (_id: string, _v: number, change: PrivateSaleStageChange) => {
      deal = { ...deal, ...change.changes, stage: change.to, version: deal.version + 1 };
      return { kind: "ok", deal } as const;
    },
  );
  const updateTerms = vi.fn(async (_id: string, _v: number, patch: object) => {
    deal = { ...deal, ...patch, version: deal.version + 1 };
    return { kind: "ok", deal } as const;
  });
  const setParty = vi.fn(
    async (
      _id: string,
      _v: number,
      party: { legalEntityId: string; actingUserId: string | null },
    ) => {
      deal = {
        ...deal,
        version: deal.version + 1,
        buyer: { role: "buyer", displayName: "New buyer", ...party },
      };
      return { kind: "ok", deal } as const;
    },
  );
  const deals = {
    findById: async () => deal,
    findByReference: async (ref: string) => (ref === deal.reference ? deal : null),
    history: async () => [],
    applyStageChange,
    updateTerms,
    setParty,
  };
  const clearancePort = { snapshot: async () => clearance };
  const transitions = new DealTransitionService({
    scope: { deals: deals as never, events },
    clearance: clearancePort,
    policy,
    now: () => new Date("2026-11-04T09:00:00Z"),
  });
  const reversal = {
    cancel: vi.fn(async () => ({ kind: "ok", deal }) as const),
    refund: vi.fn(async () => ({ ok: true, refundedMinor: 1 }) as const),
  };
  const invoices = {
    issue: vi.fn((input: { dealId: string; actorUserId: string }) =>
      transitions.transition(input.dealId, "issue_invoice", { actorUserId: input.actorUserId }),
    ),
  };
  const queryDeps = {
    deals: deals as never,
    queries: {
      list: async () => [],
      countByStage: async () => [],
      listIdsForActingUser: async () => [],
      findLiveDealReferenceForWork: async () => null,
      findWorkSummary: async () => ({
        title: "Harbour at dusk",
        reference: "C-1042",
        legalEntityId: "le-seller",
      }),
    },
    payments,
    payouts: { hasPayoutLine: async () => options.hasPayoutLine ?? false },
    transitions,
    clearance: clearancePort,
    policy,
    enquiries: { findById: async () => null },
    names: { namesOf: async () => new Map() },
  };
  const queries = new PrivateSaleDealQueryService(queryDeps);
  const commands = new PrivateSaleDealCommandService({
    deals: deals as never,
    payments,
    transitions,
    invoices,
    reversal,
    policy,
    parties: {
      resolve: async () =>
        options.partyResolves === undefined
          ? { legalEntityId: "le-new-buyer", actingUserId: "u-new-buyer" }
          : options.partyResolves,
    } as never,
    events,
    records: queries,
  });
  const real = new PrivateSaleDealDesk(queries, commands);
  // Moves are made against the version the person saw; these tests saw the deal as it is now.
  const desk = {
    list: real.list,
    detail: real.detail,
    updateTerms: real.updateTerms,
    nameBuyer: real.nameBuyer,
    act: (
      viewer: DealStaffViewer,
      ref: string,
      action: Parameters<typeof real.act>[2],
      input: { version?: number; reason?: string } = {},
    ) => real.act(viewer, ref, action, { version: deal.version, ...input }),
  };
  return {
    desk,
    real,
    events,
    reversal,
    invoices,
    updateTerms,
    setParty,
    applyStageChange,
    currentDeal: () => deal,
  };
}

const stageDeal = (stage: PrivateSaleDealStage, over: Partial<PrivateSaleDealDetail> = {}) =>
  makeDeal({ stage, ...over });

describe("the staff desk record", () => {
  it("reports what is still to be set up, so a screen can say the terms are not configured", async () => {
    const { desk } = setup({ policy: resolvePrivateSalePolicy() });
    const record = await desk.detail(MANAGER, "PS-0001");
    expect(record?.policy.gaps).toEqual([
      "terms_version",
      "commission_rate",
      "vat_treatments",
      "payment_due_days",
    ]);
    expect(record?.policy.vatTreatments).toEqual([]);
  });

  it("offers each person only the moves their role covers", async () => {
    const { desk } = setup({ deal: stageDeal("cleared", { vatTreatment: "margin_scheme" }) });
    const asManager = await desk.detail(MANAGER, "PS-0001");
    const asFinance = await desk.detail(FINANCE, "PS-0001");
    expect(asManager?.actions.map((a) => a.action)).toEqual(["cancel"]);
    expect(asFinance?.actions.map((a) => a.action)).toEqual(["issue_invoice"]);
  });

  it("says why agreement is off while the buyer's identity is not verified", async () => {
    const { desk } = setup({
      clearance: { ...CLEAR, buyer: { kyc: "pending", aml: "clear" } },
    });
    const record = await desk.detail(MANAGER, "PS-0001");
    const agree = record?.actions.find((a) => a.action === "agree");
    expect(agree?.blockers).toEqual([
      expect.objectContaining({
        code: "kyc_not_clear",
        party: "buyer",
        message: "The buyer has not verified their identity yet.",
      }),
      expect.objectContaining({ code: "terms_not_accepted", party: "seller" }),
      expect.objectContaining({ code: "terms_not_accepted", party: "buyer" }),
    ]);
  });

  it("blocks the invoice on the VAT treatment and the source of funds, never a guessed value", async () => {
    const { desk } = setup({
      deal: stageDeal("cleared", { vatTreatment: null, priceMinor: 900_000 }),
      clearance: { ...CLEAR, buyerSourceOfFunds: "pending" },
    });
    const record = await desk.detail(FINANCE, "PS-0001");
    const codes = record?.actions
      .find((a) => a.action === "issue_invoice")
      ?.blockers.map((b) => b.code);
    expect(codes).toEqual(
      expect.arrayContaining(["source_of_funds_not_satisfied", "vat_treatment_not_chosen"]),
    );
    expect(record?.sourceOfFunds).toMatchObject({ required: true, status: "pending" });
  });

  it("blocks the invoice entirely when the VAT treatments and the payment deadline are not configured", async () => {
    const { desk } = setup({
      deal: stageDeal("cleared", { vatTreatment: null }),
      policy: resolvePrivateSalePolicy({ commissionRateBps: 1500, termsVersion: "v1" }),
    });
    const record = await desk.detail(FINANCE, "PS-0001");
    expect(
      record?.actions.find((a) => a.action === "issue_invoice")?.blockers.map((b) => b.code),
    ).toEqual(
      expect.arrayContaining(["vat_treatments_not_configured", "payment_due_days_not_configured"]),
    );
  });

  it("stops the person who agreed from also issuing the invoice", async () => {
    const { desk } = setup({
      deal: stageDeal("cleared", { agreedByUserId: "u-finance", vatTreatment: "margin_scheme" }),
    });
    const record = await desk.detail(FINANCE, "PS-0001");
    expect(
      record?.actions.find((a) => a.action === "issue_invoice")?.blockers.map((b) => b.code),
    ).toEqual(["same_person_agreed_and_invoiced"]);
  });

  it("offers a refund only once the buyer has paid, and not after a payout includes the deal", async () => {
    const paid = new InMemoryDealPayments([makePayment({ status: "paid", paidAt: new Date() })]);
    const open = await setup({ deal: stageDeal("paid"), payments: paid }).desk.detail(
      FINANCE,
      "PS-0001",
    );
    expect(open?.actions.map((a) => a.action)).toEqual(expect.arrayContaining(["refund"]));
    expect(open?.actions.find((a) => a.action === "refund")?.blockers).toEqual([]);

    const queued = await setup({
      deal: stageDeal("released"),
      payments: paid,
      hasPayoutLine: true,
    }).desk.detail(FINANCE, "PS-0001");
    expect(queued?.actions.find((a) => a.action === "refund")?.blockers[0]?.code).toBe(
      "payout_queued",
    );

    const unpaid = await setup({ deal: stageDeal("invoiced") }).desk.detail(FINANCE, "PS-0001");
    expect(unpaid?.actions.some((a) => a.action === "refund")).toBe(false);
  });

  it("lists only the terms the person may change in this stage", async () => {
    const { desk } = setup({ deal: stageDeal("agreed") });
    // Everything either side accepted is locked once the price is agreed; only VAT stays open.
    expect((await desk.detail(MANAGER, "PS-0001"))?.editableTerms).toEqual([]);
    expect((await desk.detail(FINANCE, "PS-0001"))?.editableTerms).toEqual(["vatTreatment"]);
    const offer = setup({ deal: stageDeal("offer") });
    expect((await offer.desk.detail(MANAGER, "PS-0001"))?.editableTerms.sort()).toEqual(
      ["costsMinor", "offerExpiresAt", "partiesDisclosed", "priceMinor"].sort(),
    );
    const invoiced = await setup({ deal: stageDeal("invoiced") }).desk.detail(FINANCE, "PS-0001");
    expect(invoiced?.editableTerms).toEqual([]);
  });
});

describe("PrivateSaleDealDeskService buyer access", () => {
  it("lets only those who run the deal name the buyer, and only until the price is agreed", async () => {
    const offer = setup({ deal: stageDeal("offer") });
    expect((await offer.desk.detail(MANAGER, "PS-0001"))?.canNameBuyer).toBe(true);
    expect((await offer.desk.detail(FINANCE, "PS-0001"))?.canNameBuyer).toBe(false);
    const agreed = setup({ deal: stageDeal("agreed") });
    expect((await agreed.desk.detail(MANAGER, "PS-0001"))?.canNameBuyer).toBe(false);
  });
});

describe("PrivateSaleDealDeskService updateTerms", () => {
  it("changes the terms a manager may change and records only the field names", async () => {
    const { desk, updateTerms, events } = setup();
    const result = await desk.updateTerms(MANAGER, "PS-0001", {
      version: 4,
      terms: { priceMinor: 5_000_000, partiesDisclosed: true },
    });
    expect(result.ok).toBe(true);
    expect(updateTerms).toHaveBeenCalledWith("deal-1", 4, {
      priceMinor: 5_000_000,
      partiesDisclosed: true,
    });
    expect(events.events).toEqual([
      {
        eventType: "private_sale_deal.terms_changed",
        payload: {
          dealId: "deal-1",
          reference: "PS-0001",
          fields: ["priceMinor", "partiesDisclosed"],
        },
      },
    ]);
  });

  it("refuses a money term to someone without finance access", async () => {
    const { desk, updateTerms } = setup();
    expect(
      await desk.updateTerms(MANAGER, "PS-0001", {
        version: 4,
        terms: { vatTreatment: "margin_scheme" },
      }),
    ).toEqual({ ok: false, error: "forbidden", fields: ["vatTreatment"] });
    expect(updateTerms).not.toHaveBeenCalled();
  });

  it("refuses a VAT treatment that is not on the approved list", async () => {
    const { desk, updateTerms } = setup();
    expect(
      await desk.updateTerms(FINANCE, "PS-0001", {
        version: 4,
        terms: { vatTreatment: "made_up" },
      }),
    ).toEqual({ ok: false, error: "vat_treatment_not_allowed", fields: ["vatTreatment"] });
    expect(updateTerms).not.toHaveBeenCalled();
  });

  it("accepts a VAT treatment from the list, and clearing it", async () => {
    const { desk } = setup();
    expect(
      (
        await desk.updateTerms(FINANCE, "PS-0001", {
          version: 4,
          terms: { vatTreatment: "margin_scheme" },
        })
      ).ok,
    ).toBe(true);
    expect(
      (await desk.updateTerms(FINANCE, "PS-0001", { version: 5, terms: { vatTreatment: null } }))
        .ok,
    ).toBe(true);
  });

  it("locks the price once both sides have agreed it", async () => {
    const { desk, updateTerms } = setup({ deal: stageDeal("agreed") });
    expect(
      await desk.updateTerms(MANAGER, "PS-0001", { version: 4, terms: { priceMinor: 1 } }),
    ).toEqual({ ok: false, error: "term_locked", fields: ["priceMinor"] });
    expect(updateTerms).not.toHaveBeenCalled();
  });

  it("locks every term once the invoice is issued", async () => {
    const { desk } = setup({ deal: stageDeal("invoiced") });
    expect(
      await desk.updateTerms(FINANCE, "PS-0001", {
        version: 4,
        terms: { sellerCommissionBps: 100 },
      }),
    ).toEqual({ ok: false, error: "term_locked", fields: ["sellerCommissionBps"] });
  });

  it("refuses a change made against an older version of the deal", async () => {
    const { desk } = setup();
    expect(
      await desk.updateTerms(MANAGER, "PS-0001", { version: 2, terms: { costsMinor: 1 } }),
    ).toEqual({
      ok: false,
      error: "stale_version",
      currentVersion: 4,
    });
  });

  it("reports an unknown deal", async () => {
    const { desk } = setup();
    expect(
      await desk.updateTerms(MANAGER, "PS-9999", { version: 1, terms: { costsMinor: 1 } }),
    ).toEqual({
      ok: false,
      error: "deal_not_found",
    });
  });
});

describe("PrivateSaleDealDeskService nameBuyer", () => {
  it("names the person acting for the buyer and records that a party was named, not who", async () => {
    const { desk, setParty, events } = setup({ deal: stageDeal("proposed", { buyer: null }) });
    const result = await desk.nameBuyer(MANAGER, "PS-0001", {
      version: 4,
      buyerUserId: "u-new-buyer",
    });
    expect(result.ok).toBe(true);
    expect(setParty).toHaveBeenCalledWith("deal-1", 4, {
      role: "buyer",
      legalEntityId: "le-new-buyer",
      actingUserId: "u-new-buyer",
    });
    expect(events.events).toEqual([
      {
        eventType: "private_sale_deal.party_named",
        payload: {
          dealId: "deal-1",
          reference: "PS-0001",
          role: "buyer",
          actingUserId: "u-new-buyer",
        },
      },
    ]);
  });

  it("cannot name a buyer who is not a client, or who is not a member of the organisation", async () => {
    const { desk, setParty } = setup({
      deal: stageDeal("proposed", { buyer: null }),
      partyResolves: null,
    });
    expect(
      await desk.nameBuyer(MANAGER, "PS-0001", { version: 4, buyerUserId: "u-staff" }),
    ).toEqual({
      ok: false,
      error: "buyer_invalid",
    });
    expect(setParty).not.toHaveBeenCalled();
  });

  it("cannot make the seller the buyer", async () => {
    const { desk } = setup({
      deal: stageDeal("proposed", { buyer: null }),
      partyResolves: { legalEntityId: "le-seller", actingUserId: "u-seller" },
    });
    expect(
      await desk.nameBuyer(MANAGER, "PS-0001", { version: 4, buyerUserId: "u-seller" }),
    ).toEqual({
      ok: false,
      error: "buyer_is_seller",
    });
  });

  it("does not change the buyer once the price is agreed", async () => {
    const { desk } = setup({ deal: stageDeal("agreed") });
    expect(await desk.nameBuyer(MANAGER, "PS-0001", { version: 4, buyerUserId: "u-x" })).toEqual({
      ok: false,
      error: "buyer_locked",
    });
  });

  it("needs the right to run the deal", async () => {
    const { desk } = setup({ deal: stageDeal("proposed", { buyer: null }) });
    expect(await desk.nameBuyer(FINANCE, "PS-0001", { version: 4, buyerUserId: "u-x" })).toEqual({
      ok: false,
      error: "forbidden",
    });
  });
});

describe("PrivateSaleDealDeskService act", () => {
  it("refuses a move the person's role does not cover, without touching the deal", async () => {
    const { desk, applyStageChange, invoices } = setup({ deal: stageDeal("cleared") });
    expect(await desk.act(MANAGER, "PS-0001", "issue_invoice", {})).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(invoices.issue).not.toHaveBeenCalled();
    expect(applyStageChange).not.toHaveBeenCalled();
  });

  it("agrees an offer when both sides have accepted and everything is clear, and clears it at once", async () => {
    const accepted = (legalEntityId: string) => ({
      id: `d-${legalEntityId}`,
      dealId: "deal-1",
      kind: "terms" as const,
      audience: "both" as const,
      legalEntityId,
      version: "v1",
      uploadObjectId: null,
      acceptedAt: new Date(),
      acceptedByUserId: "u",
      createdByUserId: "u",
      createdAt: new Date(),
    });
    const { desk, currentDeal } = setup({
      deal: stageDeal("offer", { documents: [accepted("le-seller"), accepted("le-buyer")] }),
    });
    const result = await desk.act(MANAGER, "PS-0001", "agree", {});
    expect(result.ok).toBe(true);
    expect(currentDeal().stage).toBe("cleared");
    expect(currentDeal().agreedByUserId).toBe("u-staff");
  });

  it("keeps an agreed deal where it is when the checks are not clear, and reports why", async () => {
    const { desk, currentDeal } = setup({
      deal: stageDeal("agreed"),
      clearance: { ...CLEAR, seller: { kyc: "clear", aml: "review" } },
    });
    const result = await desk.act(MANAGER, "PS-0001", "clear", {});
    expect(result).toMatchObject({ ok: false, error: "blocked" });
    expect(result.ok === false && result.blockers?.[0]).toMatchObject({
      code: "aml_not_clear",
      party: "seller",
      message: "The seller's screening is not clear. Compliance decides.",
    });
    expect(currentDeal().stage).toBe("agreed");
  });

  it("cannot invoice without a VAT treatment from the list", async () => {
    const { desk, currentDeal } = setup({
      deal: stageDeal("cleared", { vatTreatment: null, agreedByUserId: "u-other" }),
    });
    const result = await desk.act(FINANCE, "PS-0001", "issue_invoice", {});
    expect(result).toMatchObject({ ok: false, error: "blocked" });
    expect(currentDeal().stage).toBe("cleared");
  });

  it("invoices a cleared deal with the terms set, by a different person from the one who agreed", async () => {
    const { desk, currentDeal } = setup({
      deal: stageDeal("cleared", { vatTreatment: "margin_scheme", agreedByUserId: "u-other" }),
    });
    const result = await desk.act(FINANCE, "PS-0001", "issue_invoice", {});
    expect(result.ok).toBe(true);
    expect(currentDeal().stage).toBe("invoiced");
    expect(currentDeal().invoicedByUserId).toBe("u-finance");
  });

  it("does not cancel, or end a checkout, without a reason", async () => {
    const { desk, reversal } = setup({ deal: stageDeal("invoiced") });
    const result = await desk.act(MANAGER, "PS-0001", "cancel", {});
    expect(result).toMatchObject({ ok: false, error: "blocked" });
    expect(result.ok === false && result.blockers?.map((b) => b.code)).toEqual([
      "cancel_reason_required",
    ]);
    expect(reversal.cancel).not.toHaveBeenCalled();
  });

  it("does not cancel a paid deal until the buyer has been refunded", async () => {
    const payments = new InMemoryDealPayments([makePayment({ status: "paid" })]);
    const { desk, reversal } = setup({ deal: stageDeal("paid"), payments });
    const result = await desk.act(MANAGER, "PS-0001", "cancel", { reason: "Seller withdrew" });
    expect(result.ok === false && result.blockers?.map((b) => b.code)).toEqual([
      "refund_not_recorded",
    ]);
    expect(reversal.cancel).not.toHaveBeenCalled();
  });

  it("cancels through the reversal service once the reason is given", async () => {
    const { desk, reversal } = setup({ deal: stageDeal("invoiced") });
    await desk.act(MANAGER, "PS-0001", "cancel", { reason: "Buyer withdrew" });
    expect(reversal.cancel).toHaveBeenCalledWith({
      dealId: "deal-1",
      actorUserId: "u-staff",
      reason: "Buyer withdrew",
      expectedVersion: 4,
    });
  });

  it("returns the buyer's money through the reversal service, for finance only", async () => {
    const payments = new InMemoryDealPayments([makePayment({ status: "paid" })]);
    const { desk, reversal } = setup({ deal: stageDeal("paid"), payments });
    expect(await desk.act(MANAGER, "PS-0001", "refund", {})).toMatchObject({ error: "forbidden" });
    expect(reversal.refund).not.toHaveBeenCalled();
    await desk.act(FINANCE, "PS-0001", "refund", {});
    expect(reversal.refund).toHaveBeenCalledWith({ dealId: "deal-1", actorUserId: "u-finance" });
  });

  it("explains a refund that cannot be made", async () => {
    const { desk, reversal } = setup({ deal: stageDeal("released") });
    reversal.refund.mockResolvedValueOnce({ ok: false, error: "payout_queued" } as never);
    const result = await desk.act(FINANCE, "PS-0001", "refund", {});
    expect(result).toMatchObject({ ok: false, error: "blocked" });
    expect(result.ok === false && result.blockers?.[0]?.code).toBe("payout_queued");
  });

  it("reports an unknown deal", async () => {
    const { desk } = setup();
    expect(await desk.act(MANAGER, "PS-9999", "agree", {})).toEqual({
      ok: false,
      error: "deal_not_found",
    });
  });
});

describe("the staff desk: locked terms and versions", () => {
  it.each([
    ["priceMinor", MANAGER, { priceMinor: 1 }],
    ["costsMinor", MANAGER, { costsMinor: 1 }],
    ["partiesDisclosed", MANAGER, { partiesDisclosed: true }],
    ["buyerFeeBps", FINANCE, { buyerFeeBps: 100 }],
    ["sellerCommissionBps", FINANCE, { sellerCommissionBps: 100 }],
  ] as const)("refuses a change to %s once the price is agreed", async (field, viewer, terms) => {
    const { desk, updateTerms } = setup({ deal: stageDeal("agreed") });
    expect(await desk.updateTerms(viewer, "PS-0001", { version: 4, terms })).toEqual({
      ok: false,
      error: "term_locked",
      fields: [field],
    });
    expect(updateTerms).not.toHaveBeenCalled();
  });

  it("still lets finance choose the VAT treatment after agreement", async () => {
    const { desk } = setup({ deal: stageDeal("agreed", { vatTreatment: null }) });
    const result = await desk.updateTerms(FINANCE, "PS-0001", {
      version: 4,
      terms: { vatTreatment: "margin_scheme" },
    });
    expect(result.ok).toBe(true);
  });

  it.each(["open_offer", "agree", "clear", "cancel"] as const)(
    "refuses %s made against an older version, and changes nothing",
    async (action) => {
      const { real, applyStageChange, reversal } = setup();
      expect(await real.act(MANAGER, "PS-0001", action, { version: 3, reason: "x" })).toEqual({
        ok: false,
        error: "stale_version",
        currentVersion: 4,
      });
      expect(applyStageChange).not.toHaveBeenCalled();
      expect(reversal.cancel).not.toHaveBeenCalled();
    },
  );

  it("passes the version the person saw to the write, so it is conditional on it", async () => {
    const { desk, applyStageChange } = setup({ deal: stageDeal("agreed") });
    await desk.act(MANAGER, "PS-0001", "clear", { version: 4 });
    expect(applyStageChange).toHaveBeenCalledWith("deal-1", 4, expect.anything());
  });

  it("refuses an invoice and a refund made against an older version", async () => {
    const { real, invoices, reversal } = setup({ deal: stageDeal("cleared") });
    expect(await real.act(FINANCE, "PS-0001", "issue_invoice", { version: 1 })).toMatchObject({
      error: "stale_version",
    });
    expect(await real.act(FINANCE, "PS-0001", "refund", { version: 1 })).toMatchObject({
      error: "stale_version",
    });
    expect(invoices.issue).not.toHaveBeenCalled();
    expect(reversal.refund).not.toHaveBeenCalled();
  });

  it("cannot invoice while the commission rate is not configured in policy, even if typed on the deal", async () => {
    const { desk, currentDeal } = setup({
      deal: stageDeal("cleared", { vatTreatment: "margin_scheme", agreedByUserId: "u-other" }),
      policy: resolvePrivateSalePolicy({
        vatTreatments: [{ code: "margin_scheme", label: "Margin scheme" }],
        termsVersion: "v1",
        paymentDueDays: 7,
      }),
    });
    const result = await desk.act(FINANCE, "PS-0001", "issue_invoice", {});
    expect(result.ok === false && result.blockers?.map((b) => b.code)).toContain(
      "commission_rate_not_configured",
    );
    expect(currentDeal().stage).toBe("cleared");
  });
});

describe("the staff desk: who sees which deal", () => {
  const SPECIALIST = staff({ manage: true }, "u-spec", {
    scope: { kind: "owned", userId: "u-spec" },
  });
  const FULFILMENT = staff({ release: true }, "u-ful", {
    checks: false,
    scope: { kind: "stages", stages: ["paid"] },
  });
  const FINANCE_ONLY = staff({ finance: true }, "u-fin", { checks: false });

  it("shows a specialist only the deals they own, and answers not found for any other", async () => {
    const { desk, real } = setup({ deal: stageDeal("offer", { ownerUserId: "u-other" }) });
    expect(await desk.detail(SPECIALIST, "PS-0001")).toBeNull();
    expect(await desk.detail(MANAGER, "PS-0001")).not.toBeNull();
    const own = setup({ deal: stageDeal("offer", { ownerUserId: "u-spec" }) });
    expect(await own.desk.detail(SPECIALIST, "PS-0001")).not.toBeNull();
    expect(real).toBeDefined();
  });

  it("does not let a specialist act on, or change, a deal that is not theirs", async () => {
    const { real, updateTerms, applyStageChange } = setup({
      deal: stageDeal("offer", { ownerUserId: "u-other" }),
    });
    expect(await real.act(SPECIALIST, "PS-0001", "cancel", { version: 4, reason: "x" })).toEqual({
      ok: false,
      error: "deal_not_found",
    });
    expect(
      await real.updateTerms(SPECIALIST, "PS-0001", { version: 4, terms: { costsMinor: 1 } }),
    ).toEqual({ ok: false, error: "deal_not_found" });
    expect(await real.nameBuyer(SPECIALIST, "PS-0001", { version: 4, buyerUserId: "u" })).toEqual({
      ok: false,
      error: "deal_not_found",
    });
    expect(updateTerms).not.toHaveBeenCalled();
    expect(applyStageChange).not.toHaveBeenCalled();
  });

  it("shows fulfilment only deals that are paid and ready to release", async () => {
    expect(
      await setup({ deal: stageDeal("invoiced") }).desk.detail(FULFILMENT, "PS-0001"),
    ).toBeNull();
    expect(
      await setup({ deal: stageDeal("paid") }).desk.detail(FULFILMENT, "PS-0001"),
    ).not.toBeNull();
  });

  it("gives fulfilment and finance the record without the screening or source-of-funds sections", async () => {
    for (const viewer of [FULFILMENT, FINANCE_ONLY]) {
      const { desk } = setup({
        deal: stageDeal("paid"),
        clearance: { ...CLEAR, seller: { kyc: "clear", aml: "review" } },
      });
      const record = await desk.detail(viewer, "PS-0001");
      expect(record?.sourceOfFunds).toBeNull();
      expect(record?.seller).toMatchObject({ kyc: null, aml: null });
      expect(record?.buyer).toMatchObject({ kyc: null, aml: null });
    }
    const full = await setup({ deal: stageDeal("paid") }).desk.detail(MANAGER, "PS-0001");
    expect(full?.sourceOfFunds).not.toBeNull();
    expect(full?.seller.kyc).toBe("clear");
  });

  it("tells finance a deal is waiting on checks without saying which", async () => {
    const { desk } = setup({
      deal: stageDeal("cleared", { vatTreatment: "margin_scheme", agreedByUserId: "u-other" }),
      clearance: {
        ...CLEAR,
        buyer: { kyc: "pending", aml: "review" },
        buyerSourceOfFunds: "pending",
      },
    });
    const record = await desk.detail(FINANCE_ONLY, "PS-0001");
    const invoice = record?.actions.find((a) => a.action === "issue_invoice");
    expect(invoice?.blockers.map((b) => b.code)).toEqual(["checks_pending"]);
    const result = await desk.act(FINANCE_ONLY, "PS-0001", "issue_invoice", {});
    expect(result.ok === false && result.blockers?.map((b) => b.code)).toEqual(["checks_pending"]);
  });
});
