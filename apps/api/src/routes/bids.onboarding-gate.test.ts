import type { UserRole } from "@auction/types";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createRequireAccountOnboarding } from "../middleware/require-account-onboarding.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createBidRoutes } from "./bids.js";

const lotId = "550e8400-e29b-41d4-a716-446655440000";

function mount() {
  const redis = {
    evalsha: vi.fn(),
    script: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    pttl: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
  } as unknown as Redis;
  const placeBid = vi.fn();
  const container = {
    env: {},
    redis,
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    kycService: { isConfigured: () => false },
    bidding: {
      placeBidHttp: { placeBid },
      autoBidHttp: {},
      absenteeBidHttp: {},
      saleRegistrationHttp: {},
      lotBidHistoryHttp: {},
      conditionReportHttp: {},
    },
    requireSubmissionsLegalEntityContext: createMiddleware(async (c, next) => {
      c.set("legalEntityContext", {
        legalEntityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        userId: c.get("userId") as string,
        role: "owner",
        isPrimaryAdmin: true,
      });
      await next();
    }),
    accountOnboardingGate: { isComplete: vi.fn().mockResolvedValue(false) },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "client-1",
      role: "client",
      scopes: ["bid.write"],
    }),
  };
  const requireAccountOnboarding = createRequireAccountOnboarding(container.accountOnboardingGate);
  type Vars = { userId?: string; userRole?: UserRole };
  const app = new Hono<{ Variables: Vars }>();
  app.use("*", async (c, next) => {
    c.set("userId", "client-1");
    c.set("userRole", "client");
    await next();
  });
  app.route("/bids", createBidRoutes(container, authenticator, requireAccountOnboarding));
  return { app, placeBid };
}

describe("bid routes account onboarding gate", () => {
  it("returns 403 onboarding_required before placing a bid", async () => {
    const { app, placeBid } = mount();
    const res = await app.request("/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId, amount: 100 }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("onboarding_required");
    expect(placeBid).not.toHaveBeenCalled();
  });
});
