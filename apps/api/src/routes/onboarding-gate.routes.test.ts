import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { ContainerOrganizationRoutesSlice } from "../container.js";
import type { ContainerPaymentHttpRoutesSlice } from "../container.js";
import { createRequireAccountOnboarding } from "../middleware/require-account-onboarding.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { stubSubmissionRouteServices } from "../testing/stub-submission-route-services.js";
import { createOrganizationRoutes } from "./organizations.js";
import { createPaymentRoutes } from "./payments.js";
import type { SaleHono } from "./sales/_shared.js";
import { attachSaleRegistrationRoutes } from "./sales/registration.routes.js";
import { createSubmissionRoutes } from "./submissions.js";

const saleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const buyerEntityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const lotId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const addressId = "dddddddd-dddd-4ddd-8ddd-ddddddddddddd";
const categoryId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function clientAuthenticator(): IAuthenticator {
  return {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "client-1",
      role: "client",
      scopes: ["bid.write", "bid.read"],
    }),
  };
}

function gateBlocking() {
  return createRequireAccountOnboarding({
    isComplete: vi.fn().mockResolvedValue(false),
  });
}

describe("account onboarding gate on product routes", () => {
  it("POST /sales/:id/register returns onboarding_required", async () => {
    const requestRegistration = vi.fn();
    const authenticator = clientAuthenticator();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      bidding: {
        saleRegistrationHttp: { requestRegistration },
      },
    };
    const requireAuth = createRequireAuth(authenticator, {
      isSuspended: () => Promise.resolve(false),
    });
    const requireLegalEntity = createMiddleware(async (c, next) => {
      c.set("legalEntityContext", { legalEntityId: buyerEntityId });
      await next();
    });
    const kycGate = createMiddleware(async (_c, next) => next());
    const sales = new Hono() as SaleHono;
    attachSaleRegistrationRoutes(sales, {
      container: container as never,
      requireAuth,
      requireAccountOnboarding: gateBlocking(),
      kycGate,
      requireLegalEntity,
    });
    const app = new Hono();
    app.route("/sales", sales);
    const res = await app.request(`/sales/${saleId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerLegalEntityId: buyerEntityId }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code?: string }).code).toBe("onboarding_required");
    expect(requestRegistration).not.toHaveBeenCalled();
  });

  it("POST /submissions returns onboarding_required", async () => {
    const createDraft = vi.fn();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      requireSubmissionsLegalEntityContext: createMiddleware(async (c, next) => {
        c.set("legalEntityContext", { legalEntityId: buyerEntityId });
        await next();
      }),
      submissionRoutes: stubSubmissionRouteServices({
        sellerHttp: { createDraft } as never,
      }),
    } as unknown as Container;
    const app = new Hono();
    app.route(
      "/submissions",
      createSubmissionRoutes(container, clientAuthenticator(), gateBlocking()),
    );
    const res = await app.request("/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test piece", categoryIds: [categoryId] }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code?: string }).code).toBe("onboarding_required");
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("POST /payments returns onboarding_required", async () => {
    const initiateBuyerCheckout = vi.fn();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      finance: {
        buyerPaymentHttp: { initiateBuyerCheckout },
        entityStaffPayment: {},
      },
      legalEntityRepository: { findActiveMembership: vi.fn().mockResolvedValue(null) },
      impersonationAuditService: { recordSessionTimedOut: vi.fn() },
      impersonationSessionService: { validateForRequest: vi.fn() },
    } as unknown as ContainerPaymentHttpRoutesSlice;
    const app = new Hono();
    app.route("/payments", createPaymentRoutes(container, clientAuthenticator(), gateBlocking()));
    const res = await app.request("/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId, addressId }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code?: string }).code).toBe("onboarding_required");
    expect(initiateBuyerCheckout).not.toHaveBeenCalled();
  });

  it("POST /organizations returns onboarding_required", async () => {
    const createOrganization = vi.fn();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      identityRoutes: {
        organizationHttp: { createOrganization },
      },
    } as unknown as ContainerOrganizationRoutesSlice;
    const passRateLimit = createMiddleware(async (_c, next) => next());
    const app = new Hono();
    app.route(
      "/organizations",
      createOrganizationRoutes(container, clientAuthenticator(), passRateLimit, gateBlocking()),
    );
    const res = await app.request("/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Acme Gallery", subkind: "gallery" }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code?: string }).code).toBe("onboarding_required");
    expect(createOrganization).not.toHaveBeenCalled();
  });
});
