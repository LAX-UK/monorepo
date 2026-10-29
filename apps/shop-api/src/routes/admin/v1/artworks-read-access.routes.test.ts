import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ID = "44444444-4444-4444-8444-444444444444";

async function status(role: ShopStaffRole, method: "GET" | "PUT" | "POST", url: string) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const base = createMinimalShopApiTestDeps().env;
  const deps = createMinimalShopApiTestDeps({
    env: { ...base, SHOP_ADMIN_ENABLED: true },
    staffReader: {
      findActiveByIdentitySubject: async (subject) => ({
        roles: [role],
        identitySubjectId: subject,
      }),
      brokerCanAccessClientParty: async () => false,
    },
  });
  const app = createShopApiApp({ deps, logger: false });
  app.setValidatorCompiler(() => () => true);
  await app.ready();
  const response = await app.inject({
    method,
    url,
    headers: {
      authorization: "Bearer admin-token-placeholder-minimum-length",
      "idempotency-key": ID,
    },
    ...(method === "GET" ? {} : { payload: {} }),
  });
  await app.close();
  return response.statusCode;
}

describe("artwork catalogue access by role", () => {
  it.each<ShopStaffRole>(["shop_admin", "catalogue_editor", "read_only", "finance"])(
    "lets %s open the artwork list",
    async (role) => {
      expect(await status(role, "GET", "/admin/v1/artworks")).not.toBe(403);
    },
  );

  it.each<ShopStaffRole>(["editor", "broker", "operations"])(
    "keeps the artwork list from %s",
    async (role) => {
      expect(await status(role, "GET", "/admin/v1/artworks")).toBe(403);
    },
  );

  it("refuses Read-only every artwork write", async () => {
    expect(await status("read_only", "PUT", `/admin/v1/artworks/${ID}`)).toBe(403);
    expect(await status("read_only", "POST", "/admin/v1/artworks")).toBe(403);
    expect(await status("read_only", "PUT", `/admin/v1/artworks/${ID}/run`)).toBe(403);
    expect(await status("read_only", "PUT", `/admin/v1/artworks/${ID}/edition-facts`)).toBe(403);
  });
});
