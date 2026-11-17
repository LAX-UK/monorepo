import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { ZOHO_MIRROR_BATCH_LIMIT } from "@auction/shop-contracts";
import { type ShopStaffRole, capabilitiesForRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { ZohoMirrorStatusService } from "../../../application/zoho-mirror/zoho-mirror-status.service.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const ALL_ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
  "editor",
  "read_only",
];
const ORDER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };

async function buildApp(role: ShopStaffRole) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const read = vi.fn(async (_entity: string, ids: readonly string[]) => ({
    consumer: "zoho_fulfilment",
    deliveries: new Map(
      ids.map((id) => [
        id,
        id === ORDER
          ? [
              {
                eventId: 1,
                status: "succeeded" as const,
                attempts: 1,
                nextRetryAt: null,
                providerReference: "Order:LAX-S-10482",
                lastError: null,
                updatedAt: new Date("2026-11-14T16:02:00.000Z"),
              },
            ]
          : [],
      ]),
    ),
  }));
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
  deps.admin.zohoMirror = new ZohoMirrorStatusService({ read });
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return { app, read };
}

describe("Zoho mirror status capabilities", () => {
  for (const role of ALL_ROLES) {
    for (const [entity, capability] of [
      ["order", "order.read"],
      ["artwork", "artwork_register.read"],
    ] as const) {
      const allowed = capabilitiesForRole(role).includes(capability);
      it(`${role} ${allowed ? "can" : "cannot"} ask about an ${entity}`, async () => {
        const { app } = await buildApp(role);
        for (const url of [
          `/admin/v1/zoho-mirror/status?entity=${entity}&id=${ORDER}`,
          `/admin/v1/zoho-mirror/statuses?entity=${entity}&ids=${ORDER}`,
        ]) {
          const response = await app.inject({ method: "GET", url, headers: auth });
          expect(response.statusCode, `${role} ${url}`).toBe(allowed ? 200 : 403);
        }
        await app.close();
      });
    }
  }

  it("needs a signed-in staff member", async () => {
    const { app } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/zoho-mirror/status?entity=order&id=${ORDER}`,
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("Zoho mirror status responses", () => {
  it("answers one order from the ledger", async () => {
    const { app } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/zoho-mirror/status?entity=order&id=${ORDER}`,
      headers: auth,
    });
    expect(response.json()).toEqual({
      entity: "order",
      id: ORDER,
      state: "mirrored",
      consumer: "zoho_fulfilment",
      notApplicableReason: null,
      mode: "live",
      lastAttemptAt: "2026-11-14T16:02:00.000Z",
      nextRetryAt: null,
      attempts: 1,
      providerReference: "Order:LAX-S-10482",
      error: null,
    });
    await app.close();
  });

  it("answers a batch in one ledger read, one item per distinct id", async () => {
    const { app, read } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/zoho-mirror/statuses?entity=order&ids=${ORDER},${OTHER},${ORDER}`,
      headers: auth,
    });
    expect(
      response.json().items.map((item: { id: string; state: string }) => [item.id, item.state]),
    ).toEqual([
      [ORDER, "mirrored"],
      [OTHER, "not_applicable"],
    ]);
    expect(read).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("refuses an id that is not a uuid, an unknown entity, and a batch that is too large", async () => {
    const { app } = await buildApp("shop_admin");
    const tooMany = Array.from(
      { length: ZOHO_MIRROR_BATCH_LIMIT + 1 },
      (_, n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    ).join(",");
    for (const url of [
      "/admin/v1/zoho-mirror/status?entity=order&id=not-a-uuid",
      `/admin/v1/zoho-mirror/status?entity=invoice&id=${ORDER}`,
      `/admin/v1/zoho-mirror/statuses?entity=order&ids=${ORDER},not-a-uuid`,
      `/admin/v1/zoho-mirror/statuses?entity=order&ids=${tooMany}`,
    ]) {
      const response = await app.inject({ method: "GET", url, headers: auth });
      expect(response.statusCode, url).toBe(400);
    }
    await app.close();
  });
});
