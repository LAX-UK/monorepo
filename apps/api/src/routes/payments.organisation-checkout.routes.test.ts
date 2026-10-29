import type { LegalEntity, LegalEntityMemberRole, Lot, UserRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerPaymentHttpRoutesSlice } from "../container.js";
import { BuyerPaymentHttpApplicationService } from "../services/finance/buyer-payment-http-application.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { IPaymentBuyerService } from "../services/interfaces/payment-service.js";
import { createPendingForWinner } from "../services/payment/create-pending-for-winner.pipeline.js";
import { LegalEntityBuyerPaymentAuthority } from "../services/payment/legal-entity-buyer-payment-authority.js";
import type { PaymentServiceDeps } from "../services/payment/payment-service-types.js";
import { passThroughAccountOnboarding } from "../testing/pass-through-account-onboarding.middleware.js";
import { createPaymentRoutes } from "./payments.js";

const LOT_ID = "30000000-0000-4000-8000-000000000001";
const ADDRESS_ID = "30000000-0000-4000-8000-000000000002";
const ORG_ID = "30000000-0000-4000-8000-0000000000a1";
const SELLER_ID = "30000000-0000-4000-8000-0000000000b1";
const PAYMENT_ID = "30000000-0000-4000-8000-0000000000c1";
const AGENT = "user-agent";

type Member = { role: LegalEntityMemberRole; removed?: boolean };

/**
 * `POST /payments` end to end through the payment pipeline and the real payment authority, over
 * in-memory accounts: a lot the organisation's buyer agent won, already invoiced and paid, so the
 * pipeline returns at the existing payment without touching the card rails.
 */
function mount(payer: string, member: Member | null, status: LegalEntity["status"] = "approved") {
  const lot = {
    id: LOT_ID,
    status: "ended",
    winnerId: AGENT,
    buyerLegalEntityId: ORG_ID,
    sellerLegalEntityId: SELLER_ID,
  } as Lot;
  const accounts = {
    findById: vi.fn(async () => ({ id: ORG_ID, kind: "organisation", status }) as LegalEntity),
    findActiveMembership: vi.fn(async (userId: string, legalEntityId: string) =>
      member && !member.removed && userId === payer
        ? { userId, legalEntityId, role: member.role, isPrimaryAdmin: false }
        : null,
    ),
  };
  const payments = {
    findOpenByLotAndBuyerAccount: vi.fn(async () => ({ id: PAYMENT_ID, status: "captured" })),
  };
  const deps = {
    lots: { findById: vi.fn(async () => lot) },
    payments,
    addresses: {
      findByIdForUser: vi.fn(async () => ({
        id: ADDRESS_ID,
        label: "Office",
        line1: "1 Bank Street",
        line2: null,
        city: "London",
        state: null,
        postalCode: "EC1A 1AA",
        country: "GB",
        addressType: "shipping",
      })),
    },
    lotFulfilmentHooks: null,
    buyerPaymentAuthority: new LegalEntityBuyerPaymentAuthority(accounts),
  } as unknown as PaymentServiceDeps;
  const paymentBuyerService = {
    createPendingForWinner: (buyerId: string, lotId: string, addressId: string) =>
      createPendingForWinner(deps, buyerId, lotId, addressId),
  } as unknown as IPaymentBuyerService;
  const buyerPaymentHttp = new BuyerPaymentHttpApplicationService(
    {} as never,
    {} as never,
    paymentBuyerService,
    {} as never,
    {} as never,
    { emit: vi.fn(async () => undefined) } as never,
    {} as never,
    false,
  );
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    finance: { buyerPaymentHttp, entityStaffPayment: {} },
    legalEntityRepository: accounts,
    impersonationAuditService: { recordSessionTimedOut: vi.fn() },
    impersonationSessionService: { validateForRequest: vi.fn() },
    admin: { stepUp: vi.fn() },
  } as unknown as ContainerPaymentHttpRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn(async () => ({
      id: payer,
      identitySessionId: "session-1",
      role: "client" as UserRole,
      staffRoles: [],
      scopes: ["bid.read", "bid.write"],
    })),
  };
  const app = new Hono();
  app.route(
    "/payments",
    createPaymentRoutes(container, authenticator, passThroughAccountOnboarding),
  );
  return { app, payments };
}

function pay(app: Hono) {
  return app.request("/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lotId: LOT_ID, addressId: ADDRESS_ID }),
  });
}

describe("POST /payments for an organisation's purchase", () => {
  it.each(["finance", "owner", "admin"] as const)(
    "lets %s pay a lot a colleague won, continuing the account's payment",
    async (role) => {
      const { app, payments } = mount("user-payer", { role });
      const res = await pay(app);
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({ data: { paymentId: PAYMENT_ID } });
      expect(payments.findOpenByLotAndBuyerAccount).toHaveBeenCalledWith(LOT_ID, ORG_ID);
    },
  );

  it("lets finance pay for a restricted organisation", async () => {
    const { app } = mount("user-payer", { role: "finance" }, "restricted");
    expect((await pay(app)).status).toBe(201);
  });

  it.each(["viewer", "consignor"] as const)("refuses a %s", async (role) => {
    const { app, payments } = mount("user-payer", { role });
    const res = await pay(app);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "not_organisation_payer" });
    expect(payments.findOpenByLotAndBuyerAccount).not.toHaveBeenCalled();
  });

  it("refuses the buyer agent who won: the organisation's payers pay", async () => {
    const { app } = mount(AGENT, { role: "buyer_agent" });
    const res = await pay(app);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "not_organisation_payer" });
  });

  it("refuses a removed member, even one who used to be finance", async () => {
    const { app } = mount("user-payer", { role: "finance", removed: true });
    const res = await pay(app);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "not_a_member_of_buyer_account" });
  });

  it("refuses someone with no membership at all", async () => {
    const { app } = mount("user-stranger", null);
    expect((await pay(app)).status).toBe(403);
  });
});
