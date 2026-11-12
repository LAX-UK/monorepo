import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const REGISTER_ID = "44444444-4444-4444-8444-444444444444";

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
const CAN_UPDATE: ShopStaffRole[] = ["shop_admin", "catalogue_editor"];

async function buildApp(role: ShopStaffRole) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
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
  const update = vi.fn(async () => ({ copy: "lax_art" as const, updated: ["Title"] }));
  deps.admin.catalogueChange = { update };
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return { app, update };
}

const request = (app: Awaited<ReturnType<typeof buildApp>>["app"], payload: unknown) =>
  app.inject({
    method: "POST",
    url: `/admin/v1/artwork-register/${REGISTER_ID}/catalogue-update`,
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    payload: payload as never,
  });

describe("Update from Zoho route", () => {
  for (const role of ALL_ROLES) {
    const allowed = CAN_UPDATE.includes(role);
    it(`${allowed ? "lets" : "stops"} ${role} update a draft copy`, async () => {
      const { app, update } = await buildApp(role);
      const response = await request(app, { copy: "lax_art" });
      expect(response.statusCode).toBe(allowed ? 200 : 403);
      expect(update).toHaveBeenCalledTimes(allowed ? 1 : 0);
      await app.close();
    });
  }

  it("hands the record, the copy and the staff member to the use case", async () => {
    const { app, update } = await buildApp("catalogue_editor");
    const response = await request(app, { copy: "bid_lot" });
    expect(response.json()).toEqual({ copy: "lax_art", updated: ["Title"] });
    expect(update).toHaveBeenCalledWith({
      registerId: REGISTER_ID,
      copy: "bid_lot",
      actorSubjectId: "catalogue_editor-subject",
    });
    await app.close();
  });

  it("refuses a copy that is not one", async () => {
    const { app, update } = await buildApp("catalogue_editor");
    expect((await request(app, { copy: "shop" })).statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
    await app.close();
  });
});
