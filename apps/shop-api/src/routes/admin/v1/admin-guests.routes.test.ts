import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { GuestErasureService } from "../../../application/guest-erasure/guest-erasure.service.js";
import type { GuestErasureSnapshot } from "../../../application/ports/guest-erasure.store.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const GUEST_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-10-30T12:00:00.000Z");

const GUEST: GuestErasureSnapshot = {
  guestCustomerId: GUEST_ID,
  email: "ada@example.com",
  erasedAt: null,
  claimedAt: null,
  orders: [{ reference: "LAX-S-10001", status: "paid", fulfilmentStatus: "delivered" }],
};

const BODY = {
  confirmation: "ada@example.com",
  reason: "Asked by email on 29 October to delete their data.",
};

async function buildApp(
  role: ShopStaffRole,
  options: { guest?: GuestErasureSnapshot | null; authAgeSeconds?: number } = {},
) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000) - (options.authAgeSeconds ?? 0),
    },
  } as never);
  const deps = createMinimalShopApiTestDeps({
    env: { ...createMinimalShopApiTestDeps().env, SHOP_ADMIN_ENABLED: true },
    staffReader: {
      findActiveByIdentitySubject: async (subject: string) => ({
        roles: [role],
        identitySubjectId: subject,
      }),
      brokerCanAccessClientParty: async () => false,
    },
  });
  const guest = options.guest === undefined ? GUEST : options.guest;
  const erase = vi.fn(async () => ({ orders: 1, enquiries: 2, links: 1 }));
  deps.admin.guestErasure = new GuestErasureService(
    {
      read: async () => guest,
      withLockedGuest: async (_id, work) => (guest ? work(guest, erase) : null),
    },
    () => NOW,
  );
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return { app, erase };
}

const headers = {
  authorization: `Bearer ${ADMIN_TOKEN}`,
  "idempotency-key": "erase-1",
};

describe("admin guest erasure routes", () => {
  it("lets an Administrator erase a guest whose orders are finished", async () => {
    const { app, erase } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/guests/${GUEST_ID}/erasure`,
      headers,
      payload: BODY,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      guestCustomerId: GUEST_ID,
      erasedAt: NOW.toISOString(),
      orders: 1,
      enquiries: 2,
      links: 1,
    });
    expect(erase).toHaveBeenCalledOnce();
    await app.close();
  });

  it.each<ShopStaffRole>(["account_manager", "operations", "finance", "read_only"])(
    "refuses %s, who cannot erase",
    async (role) => {
      const { app, erase } = await buildApp(role);
      const response = await app.inject({
        method: "POST",
        url: `/admin/v1/guests/${GUEST_ID}/erasure`,
        headers,
        payload: BODY,
      });
      expect(response.statusCode).toBe(403);
      expect(erase).not.toHaveBeenCalled();
      await app.close();
    },
  );

  it("asks for a recent sign-in", async () => {
    const { app, erase } = await buildApp("shop_admin", { authAgeSeconds: 60 * 60 * 24 });
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/guests/${GUEST_ID}/erasure`,
      headers,
      payload: BODY,
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe(SHOP_API_ERROR_CODES.STEP_UP_REQUIRED);
    expect(erase).not.toHaveBeenCalled();
    await app.close();
  });

  it("refuses a confirmation that does not match", async () => {
    const { app, erase } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/guests/${GUEST_ID}/erasure`,
      headers,
      payload: { ...BODY, confirmation: "someone@example.com" },
    });
    expect(response.statusCode).toBe(400);
    expect(erase).not.toHaveBeenCalled();
    await app.close();
  });

  it("explains an order still in progress", async () => {
    const { app } = await buildApp("shop_admin", {
      guest: {
        ...GUEST,
        orders: [{ reference: "LAX-S-10002", status: "paid", fulfilmentStatus: "in_production" }],
      },
    });
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/guests/${GUEST_ID}/erasure`,
      headers,
      payload: BODY,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("LAX-S-10002");
    await app.close();
  });

  it("describes whether a guest can be erased", async () => {
    const { app } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/guests/${GUEST_ID}/erasure`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      guestCustomerId: GUEST_ID,
      erasedAt: null,
      allowed: true,
      blockedReason: null,
      blockedMessage: null,
    });
    await app.close();
  });

  it("answers 404 for an unknown guest", async () => {
    const { app } = await buildApp("shop_admin", { guest: null });
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/guests/${GUEST_ID}/erasure`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
