import { type DealClearanceSnapshot, resolvePrivateSalePolicy } from "@auction/domain";
import type { PrivateSaleDealDetail } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { makeDeal, recordingSink } from "./deal-fixtures.test-util.js";
import { PrivateSaleDealPartyService } from "./deal-party.service.js";

const CLEAR: DealClearanceSnapshot = {
  seller: { kyc: "clear", aml: "clear" },
  buyer: { kyc: "clear", aml: "clear" },
  buyerSourceOfFunds: "approved",
  buyerOtherOpenExposureMinor: 0,
};

const POLICY = resolvePrivateSalePolicy({ termsVersion: "v1", commissionRateBps: 1500 });

function setup(
  deal: PrivateSaleDealDetail | null = makeDeal({ stage: "offer", vatTreatment: null }),
  options: { clearance?: DealClearanceSnapshot; policy?: typeof POLICY } = {},
) {
  const events = recordingSink();
  const recordAcceptance = vi.fn(async () => ({}) as never);
  const start = vi.fn(async () => ({
    ok: true as const,
    started: {
      paymentId: "pay-1",
      checkoutUrl: "https://pay.example/c/1",
      rail: "card" as const,
      amountMinor: 4_800_000,
    },
  }));
  const service = new PrivateSaleDealPartyService({
    deals: {
      findById: async () => deal,
      findByReference: async (ref: string) => (deal && ref === deal.reference ? deal : null),
      recordAcceptance,
    } as never,
    queries: {
      listIdsForActingUser: async (userId: string) =>
        deal && [deal.seller.actingUserId, deal.buyer?.actingUserId].includes(userId)
          ? [deal.id]
          : [],
      findWorkSummary: async () => ({
        title: "Harbour at dusk",
        reference: "C-1042",
        legalEntityId: "le-seller",
      }),
    },
    clearance: { snapshot: async () => options.clearance ?? CLEAR },
    policy: options.policy ?? POLICY,
    payments: { start },
    events,
    now: () => new Date("2026-11-04T09:00:00Z"),
  });
  return { service, recordAcceptance, start, events };
}

describe("PrivateSaleDealPartyService", () => {
  describe("what each side sees", () => {
    it("shows a buyer their total and the other side as LAX, never the seller or the commission", async () => {
      const { service } = setup(makeDeal({ stage: "invoiced", buyerFeeBps: 250 }));
      const detail = await service.detail("u-buyer", "PS-0001");
      expect(detail?.view.counterparty).toEqual({ disclosed: false, label: "LAX" });
      expect(detail?.view.buyerMoney).toEqual({
        priceMinor: 4_800_000,
        buyerFeeMinor: 120_000,
        totalDueMinor: 4_920_000,
      });
      expect(detail?.view.sellerMoney).toBeNull();
      expect(JSON.stringify(detail)).not.toMatch(/Henry Lowe|le-seller|1500|commission/i);
    });

    it("shows a seller their net and never the buyer or the buyer's fee", async () => {
      const { service } = setup(makeDeal({ stage: "invoiced", buyerFeeBps: 250 }));
      const detail = await service.detail("u-seller", "PS-0001");
      expect(detail?.view.sellerMoney).toMatchObject({
        priceMinor: 4_800_000,
        sellerCommissionMinor: 720_000,
        netToSellerMinor: 4_055_000,
      });
      expect(detail?.view.buyerMoney).toBeNull();
      expect(JSON.stringify(detail)).not.toMatch(/Marlow|le-buyer|120000/);
    });

    it("keeps the price under discussion until it is agreed", async () => {
      const { service } = setup(makeDeal({ stage: "offer" }));
      const detail = await service.detail("u-buyer", "PS-0001");
      expect(detail?.view.priceState).toBe("under_discussion");
      expect(detail?.view.buyerMoney).toBeNull();
    });

    it("answers a stranger exactly as it answers for a deal that does not exist", async () => {
      const { service } = setup();
      expect(await service.detail("u-stranger", "PS-0001")).toBeNull();
      expect(await service.detail("u-buyer", "PS-9999")).toBeNull();
      expect(await service.list("u-stranger")).toEqual([]);
    });

    it("lists a person's deals with their own side's money", async () => {
      const { service } = setup(makeDeal({ stage: "invoiced" }));
      const [buyerRow] = await service.list("u-buyer");
      expect(buyerRow).toMatchObject({
        reference: "PS-0001",
        role: "buyer",
        workTitle: "Harbour at dusk",
        totalDueMinor: 4_800_000,
        netToSellerMinor: null,
        needs: "pay",
      });
      const [sellerRow] = await service.list("u-seller");
      expect(sellerRow).toMatchObject({ role: "seller", totalDueMinor: null });
    });
  });

  describe("what a client has to do next", () => {
    it("asks for the terms first, then identity, then proof of funds, then payment", async () => {
      const offer = makeDeal({ stage: "offer", priceMinor: 4_800_000 });
      expect((await setup(offer).service.detail("u-buyer", "PS-0001"))?.needs).toBe("accept_terms");

      const accepted = {
        ...offer,
        documents: ["le-buyer"].map((legalEntityId) => ({
          id: "d",
          dealId: "deal-1",
          kind: "terms" as const,
          audience: "both" as const,
          legalEntityId,
          version: "v1",
          uploadObjectId: null,
          acceptedAt: new Date(),
          acceptedByUserId: "u-buyer",
          createdByUserId: "u-buyer",
          createdAt: new Date(),
        })),
      };
      const unverified = { ...CLEAR, buyer: { kyc: "pending", aml: "clear" } } as const;
      expect(
        (await setup(accepted, { clearance: unverified }).service.detail("u-buyer", "PS-0001"))
          ?.needs,
      ).toBe("verify_identity");

      const noFunds = { ...CLEAR, buyerSourceOfFunds: "not_requested" } as const;
      expect(
        (await setup(accepted, { clearance: noFunds }).service.detail("u-buyer", "PS-0001"))?.needs,
      ).toBe("proof_of_funds");

      const invoiced = makeDeal({ stage: "invoiced" });
      expect((await setup(invoiced).service.detail("u-buyer", "PS-0001"))?.needs).toBe("pay");
      expect((await setup(invoiced).service.detail("u-seller", "PS-0001"))?.needs).toBeNull();
    });

    it("never tells a client their screening needs review", async () => {
      const review = { ...CLEAR, buyer: { kyc: "clear", aml: "review" } } as const;
      const detail = await setup(makeDeal({ stage: "agreed" }), {
        clearance: review,
      }).service.detail("u-buyer", "PS-0001");
      expect(detail?.needs).toBeNull();
      expect(JSON.stringify(detail)).not.toMatch(/aml|screening|review/i);
    });

    it("lets only a cleared buyer pay an invoiced deal", async () => {
      const invoiced = makeDeal({ stage: "invoiced" });
      expect((await setup(invoiced).service.detail("u-buyer", "PS-0001"))?.payable).toBe(true);
      expect((await setup(invoiced).service.detail("u-seller", "PS-0001"))?.payable).toBe(false);
      const held = { ...CLEAR, buyer: { kyc: "clear", aml: "review" } } as const;
      expect(
        (await setup(invoiced, { clearance: held }).service.detail("u-buyer", "PS-0001"))?.payable,
      ).toBe(false);
    });
  });

  describe("accepting the terms", () => {
    it("records the acceptance of the current version for the party's legal entity", async () => {
      const { service, recordAcceptance, events } = setup();
      const result = await service.acceptTerms("u-buyer", "PS-0001");
      expect(result.ok).toBe(true);
      expect(recordAcceptance).toHaveBeenCalledWith({
        dealId: "deal-1",
        kind: "terms",
        legalEntityId: "le-buyer",
        version: "v1",
        userId: "u-buyer",
        at: new Date("2026-11-04T09:00:00Z"),
      });
      expect(events.events).toEqual([
        {
          eventType: "private_sale_deal.terms_accepted",
          payload: { dealId: "deal-1", reference: "PS-0001", role: "buyer", version: "v1" },
        },
      ]);
    });

    it("cannot be done while the terms are not configured", async () => {
      const { service, recordAcceptance } = setup(undefined, {
        policy: resolvePrivateSalePolicy(),
      });
      expect(await service.acceptTerms("u-buyer", "PS-0001")).toEqual({
        ok: false,
        error: "terms_not_configured",
      });
      expect(recordAcceptance).not.toHaveBeenCalled();
    });

    it("cannot be done once the price is agreed", async () => {
      const { service, recordAcceptance } = setup(makeDeal({ stage: "agreed" }));
      expect(await service.acceptTerms("u-buyer", "PS-0001")).toEqual({
        ok: false,
        error: "not_open_for_terms",
      });
      expect(recordAcceptance).not.toHaveBeenCalled();
    });

    it("cannot be done for a deal the person is not in", async () => {
      const { service, recordAcceptance } = setup();
      expect(await service.acceptTerms("u-stranger", "PS-0001")).toEqual({
        ok: false,
        error: "deal_not_found",
      });
      expect(recordAcceptance).not.toHaveBeenCalled();
    });
  });

  describe("paying", () => {
    it("opens the checkout for the buyer", async () => {
      const { service, start } = setup(makeDeal({ stage: "invoiced" }));
      expect(await service.pay("u-buyer", "PS-0001")).toEqual({
        ok: true,
        checkoutUrl: "https://pay.example/c/1",
        amountMinor: 4_800_000,
      });
      expect(start).toHaveBeenCalledWith({ dealId: "deal-1", payerUserId: "u-buyer" });
    });

    it("never opens a checkout for the seller or a stranger", async () => {
      const { service, start } = setup(makeDeal({ stage: "invoiced" }));
      expect(await service.pay("u-seller", "PS-0001")).toEqual({
        ok: false,
        error: "deal_not_found",
      });
      expect(await service.pay("u-stranger", "PS-0001")).toEqual({
        ok: false,
        error: "deal_not_found",
      });
      expect(start).not.toHaveBeenCalled();
    });

    it("passes on why a payment cannot be taken", async () => {
      const { service, start } = setup(makeDeal({ stage: "invoiced" }));
      start.mockResolvedValueOnce({ ok: false, error: { kind: "compliance_hold" } } as never);
      expect(await service.pay("u-buyer", "PS-0001")).toEqual({
        ok: false,
        error: "compliance_hold",
      });
      start.mockResolvedValueOnce({ ok: false, error: { kind: "blocked", blockers: [] } } as never);
      expect(await service.pay("u-buyer", "PS-0001")).toEqual({ ok: false, error: "not_payable" });
    });
  });
});
