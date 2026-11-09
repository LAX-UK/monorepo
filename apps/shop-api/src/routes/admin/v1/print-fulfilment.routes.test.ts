import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const headers = {
  authorization: "Bearer admin-token-placeholder-minimum-length",
  "idempotency-key": "99999999-9999-4999-8999-999999999999",
};
const LINE = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";
const ARTWORK = "11111111-1111-4111-8111-111111111111";
const CERTIFICATE = "44444444-4444-4444-8444-444444444444";

type PrintFulfilment = AdminRoutesDeps["printFulfilment"];

async function buildApp(
  role: ShopStaffRole,
  overrides: { [K in keyof PrintFulfilment]?: Partial<PrintFulfilment[K]> } = {},
) {
  vi.mocked(verifyBearerToken).mockReset();
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const base = createMinimalShopApiTestDeps();
  const fulfilment = base.admin.printFulfilment;
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_ADMIN_ENABLED: true },
      staffReader: {
        findActiveByIdentitySubject: async (subject) => ({
          roles: [role],
          identitySubjectId: subject,
        }),
        brokerCanAccessClientParty: async () => false,
      },
      admin: {
        ...base.admin,
        printFulfilment: {
          pickAndPack: { ...fulfilment.pickAndPack, ...overrides.pickAndPack },
          confirm: { ...fulfilment.confirm, ...overrides.confirm },
          swap: { ...fulfilment.swap, ...overrides.swap },
          certificates: { ...fulfilment.certificates, ...overrides.certificates },
        },
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

const confirmPayload = { source: "typed_label", value: "7/24" };
const swapPayload = { reason: "Corner creased" };

describe("admin print fulfilment routes", () => {
  it.each(["operations", "shop_admin"] as const)("lets %s confirm a print", async (role) => {
    const confirm = vi.fn(async () => ({
      outcome: "confirmed" as const,
      label: "7/24",
      certificate: { status: "none" as const, certificateId: null, note: null, issuedAt: null },
    }));
    const app = await buildApp(role, { confirm: { confirm } });
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/order-lines/${LINE}/confirm-print`,
      headers,
      payload: confirmPayload,
    });
    expect(response.statusCode).toBe(200);
    expect(confirm).toHaveBeenCalledWith({
      actorSubjectId: `${role}-subject`,
      idempotencyKey: headers["idempotency-key"],
      orderLineId: LINE,
      scanned: confirmPayload,
    });
    await app.close();
  });

  it.each(["catalogue_editor", "finance", "read_only", "broker"] as const)(
    "refuses to confirm a print for %s",
    async (role) => {
      const confirm = vi.fn();
      const app = await buildApp(role, { confirm: { confirm } });
      const response = await app.inject({
        method: "POST",
        url: `/admin/v1/order-lines/${LINE}/confirm-print`,
        headers,
        payload: confirmPayload,
      });
      expect(response.statusCode).toBe(403);
      expect(confirm).not.toHaveBeenCalled();
      await app.close();
    },
  );

  it("needs an idempotency key to confirm", async () => {
    const app = await buildApp("operations");
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/order-lines/${LINE}/confirm-print`,
      headers: { authorization: headers.authorization },
      payload: confirmPayload,
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("passes a swap to the service with whether the person may cross owners", async () => {
    const swap = vi.fn(async () => ({
      label: "9/24",
      previousLabel: "7/24",
      payoutMoved: false,
      buyerNotified: true,
    }));
    const operations = await buildApp("operations", { swap: { swap } });
    const own = await operations.inject({
      method: "POST",
      url: `/admin/v1/order-lines/${LINE}/swap-print`,
      headers,
      payload: swapPayload,
    });
    expect(own.statusCode).toBe(200);
    expect(swap).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderLineId: LINE, canSwapAcrossOwners: false }),
    );
    await operations.close();

    const admin = await buildApp("shop_admin", { swap: { swap } });
    await admin.inject({
      method: "POST",
      url: `/admin/v1/order-lines/${LINE}/swap-print`,
      headers,
      payload: swapPayload,
    });
    expect(swap).toHaveBeenLastCalledWith(expect.objectContaining({ canSwapAcrossOwners: true }));
    await admin.close();
  });

  it("refuses a swap without a reason, and to staff who cannot fulfil", async () => {
    const operations = await buildApp("operations");
    const bare = await operations.inject({
      method: "POST",
      url: `/admin/v1/order-lines/${LINE}/swap-print`,
      headers,
      payload: { reason: "" },
    });
    expect(bare.statusCode).toBe(400);
    await operations.close();

    const editor = await buildApp("catalogue_editor");
    const refused = await editor.inject({
      method: "POST",
      url: `/admin/v1/order-lines/${LINE}/swap-print`,
      headers,
      payload: swapPayload,
    });
    expect(refused.statusCode).toBe(403);
    await editor.close();
  });

  it("shows the pick list to anyone who can read orders, not to catalogue staff", async () => {
    const reader = await buildApp("read_only");
    const allowed = await reader.inject({
      method: "GET",
      url: `/admin/v1/orders/${ORDER}/pick-and-pack`,
      headers,
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toEqual({ orderId: ORDER, lines: [] });
    await reader.close();

    const editor = await buildApp("catalogue_editor");
    const refused = await editor.inject({
      method: "GET",
      url: `/admin/v1/orders/${ORDER}/pick-and-pack`,
      headers,
    });
    expect(refused.statusCode).toBe(403);
    await editor.close();
  });

  it("limits the certificates to send and marking one sent to fulfilment staff", async () => {
    const markSent = vi.fn(async () => ({ issuedAt: "2026-11-04T10:00:00.000Z" }));
    const operations = await buildApp("operations", { certificates: { markSent } });
    const list = await operations.inject({
      method: "GET",
      url: "/admin/v1/certificates/to-send",
      headers,
    });
    expect(list.statusCode).toBe(200);
    const sent = await operations.inject({
      method: "POST",
      url: `/admin/v1/certificates/${CERTIFICATE}/mark-sent`,
      headers,
    });
    expect(sent.statusCode).toBe(200);
    expect(markSent).toHaveBeenCalledWith(expect.objectContaining({ certificateId: CERTIFICATE }));
    await operations.close();

    const finance = await buildApp("finance");
    const refused = await finance.inject({
      method: "GET",
      url: "/admin/v1/certificates/to-send",
      headers,
    });
    expect(refused.statusCode).toBe(403);
    await finance.close();
  });

  it("leaves approving a hors commerce proof to shop admins", async () => {
    const approveHorsCommerce = vi.fn(async () => ({
      approvedAt: "2026-11-04T10:00:00.000Z",
      approvedBy: "shop_admin-subject",
    }));
    const editor = await buildApp("catalogue_editor", { certificates: { approveHorsCommerce } });
    const refused = await editor.inject({
      method: "POST",
      url: `/admin/v1/artworks/${ARTWORK}/hors-commerce-approval`,
      headers,
    });
    expect(refused.statusCode).toBe(403);
    expect(approveHorsCommerce).not.toHaveBeenCalled();
    await editor.close();

    const admin = await buildApp("shop_admin", { certificates: { approveHorsCommerce } });
    const allowed = await admin.inject({
      method: "POST",
      url: `/admin/v1/artworks/${ARTWORK}/hors-commerce-approval`,
      headers,
    });
    expect(allowed.statusCode).toBe(200);
    expect(approveHorsCommerce).toHaveBeenCalledOnce();
    await admin.close();
  });
});
