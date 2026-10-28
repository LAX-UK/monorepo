import { legalEntityMemberRoles } from "@auction/types";
import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerPaymentHttpRoutesSlice } from "../container.js";
import { X_LEGAL_ENTITY_ID_HEADER } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { passThroughAccountOnboarding } from "../testing/pass-through-account-onboarding.middleware.js";
import { createPaymentRoutes } from "./payments.js";

const entityId = "22222222-2222-4222-8222-222222222222";
const headers = { [X_LEGAL_ENTITY_ID_HEADER]: entityId };

const FINANCE_ROLES: LegalEntityMemberRole[] = ["owner", "admin", "finance"];
/** Works but no money. */
const WORKS_ONLY_ROLES: LegalEntityMemberRole[] = ["viewer", "buyer_agent"];
const NO_ACCESS_ROLES = legalEntityMemberRoles.filter(
  (role) => !FINANCE_ROLES.includes(role) && !WORKS_ONLY_ROLES.includes(role),
);

function mount(membership: { role: LegalEntityMemberRole } | null) {
  const buyerPaymentHttp = {
    listEntityPayments: vi.fn(async () => ({ kind: "ok" as const, data: [] })),
    listEntityWonLots: vi.fn(async () => ({ kind: "ok" as const, data: [] })),
    listMyPayments: vi.fn(async () => ({ kind: "ok" as const, data: [] })),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    finance: { entityStaffPayment: {}, buyerPaymentHttp },
    legalEntityRepository: {
      findActiveMembership: vi.fn(async (userId: string, legalEntityId: string) =>
        membership ? { userId, legalEntityId, role: membership.role, isPrimaryAdmin: false } : null,
      ),
    },
    impersonationAuditService: { recordSessionTimedOut: vi.fn() },
    impersonationSessionService: { validateForRequest: vi.fn() },
  } as unknown as ContainerPaymentHttpRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn(async () => ({
      id: "user-1",
      role: "client" as const,
      staffRoles: [],
      scopes: ["bid.read", "bid.write"],
    })),
  };
  const app = new Hono();
  app.route(
    "/payments",
    createPaymentRoutes(container, authenticator, passThroughAccountOnboarding),
  );
  return { app, buyerPaymentHttp };
}

describe("GET /payments/entity", () => {
  it.each(FINANCE_ROLES)("lists the organisation's payments for %s", async (role) => {
    const { app, buyerPaymentHttp } = mount({ role });

    const res = await app.request("/payments/entity?status=pending", { headers });

    expect(res.status).toBe(200);
    expect(buyerPaymentHttp.listEntityPayments).toHaveBeenCalledWith(entityId, {
      status: "pending",
    });
    expect(buyerPaymentHttp.listMyPayments).not.toHaveBeenCalled();
  });

  it.each([...WORKS_ONLY_ROLES, ...NO_ACCESS_ROLES])("refuses %s", async (role) => {
    const { app, buyerPaymentHttp } = mount({ role });

    const res = await app.request("/payments/entity", { headers });

    expect(res.status).toBe(403);
    expect(buyerPaymentHttp.listEntityPayments).not.toHaveBeenCalled();
  });

  it("refuses a person who is not a member of the organisation", async () => {
    const { app, buyerPaymentHttp } = mount(null);

    const res = await app.request("/payments/entity", { headers });

    expect(res.status).toBe(403);
    expect(buyerPaymentHttp.listEntityPayments).not.toHaveBeenCalled();
  });

  it("requires the acting organisation header", async () => {
    const { app } = mount({ role: "owner" });

    expect((await app.request("/payments/entity")).status).toBe(400);
  });
});

describe("GET /payments/entity/wins", () => {
  it.each(FINANCE_ROLES)("shows %s the works with prices", async (role) => {
    const { app, buyerPaymentHttp } = mount({ role });

    const res = await app.request("/payments/entity/wins?limit=5", { headers });

    expect(res.status).toBe(200);
    expect(buyerPaymentHttp.listEntityWonLots).toHaveBeenCalledWith(entityId, {
      limit: 5,
      offset: 0,
      includeHammerPrice: true,
    });
  });

  it.each(WORKS_ONLY_ROLES)("shows %s the works without prices", async (role) => {
    const { app, buyerPaymentHttp } = mount({ role });

    const res = await app.request("/payments/entity/wins", { headers });

    expect(res.status).toBe(200);
    expect(buyerPaymentHttp.listEntityWonLots).toHaveBeenCalledWith(entityId, {
      limit: 50,
      offset: 0,
      includeHammerPrice: false,
    });
  });

  it.each(NO_ACCESS_ROLES)("refuses %s", async (role) => {
    const { app, buyerPaymentHttp } = mount({ role });

    const res = await app.request("/payments/entity/wins", { headers });

    expect(res.status).toBe(403);
    expect(buyerPaymentHttp.listEntityWonLots).not.toHaveBeenCalled();
  });
});

describe("GET /payments/me", () => {
  it("stays the person's own list and ignores the acting organisation", async () => {
    const { app, buyerPaymentHttp } = mount({ role: "viewer" });

    const res = await app.request("/payments/me", { headers });

    expect(res.status).toBe(200);
    expect(buyerPaymentHttp.listMyPayments).toHaveBeenCalledWith("user-1", {});
    expect(buyerPaymentHttp.listEntityPayments).not.toHaveBeenCalled();
  });
});
