import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { SoldAttentionReviewService } from "../../../application/artwork-register/sold-attention-review.service.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const REGISTER_ID = "44444444-4444-4444-8444-444444444444";
const ATTENTION_ID = "66666666-6666-4666-8666-666666666666";
const auth = { authorization: "Bearer admin-token-placeholder-minimum-length" };

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

type Reopen = NonNullable<
  ConstructorParameters<typeof SoldAttentionReviewService>[0]["sales"]
>["reopenGallerySale"];

const reopened: Reopen = async (input) => ({
  ok: true,
  entry: { id: input.registerId, offer: { state: "held", ref: null } } as never,
  reason: input.reason,
});

async function buildApp(
  role: ShopStaffRole,
  reopenGallerySale: Reopen = reopened,
  authTime = Math.floor(Date.now() / 1000),
) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: authTime,
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
  deps.admin.soldAttention = new SoldAttentionReviewService({
    queue: {
      listOpen: async () => [],
      override: async () => ({ ok: false, reason: "not_found" }),
      markDealtWith: async (input) => ({
        ok: true,
        item: { id: input.id, registerId: REGISTER_ID } as never,
      }),
    },
    lots: { numbersFor: async () => new Map() },
    sales: { reopenGallerySale },
  });
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return app;
}

const reopen = (app: Awaited<ReturnType<typeof buildApp>>, reason = "Wrong Product in Zoho") =>
  app.inject({
    method: "POST",
    url: `/admin/v1/artwork-register/${REGISTER_ID}/reopen-sale`,
    headers: auth,
    payload: { reason },
  });

describe("Reopen a sale made in the gallery", () => {
  for (const role of ALL_ROLES) {
    const allowed = role === "shop_admin";
    it(`${allowed ? "lets" : "stops"} ${role}`, async () => {
      const app = await buildApp(role);
      const response = await reopen(app);
      expect(response.statusCode).toBe(allowed ? 200 : 403);
      if (allowed) expect(response.json()).toEqual({ registerId: REGISTER_ID, offerState: "held" });
      await app.close();
    });
  }

  it("refuses with 409 and Zoho's rule while Zoho still says Sold", async () => {
    const app = await buildApp("shop_admin", async () => ({
      ok: false,
      refusal: "zoho_still_sold",
    }));
    const response = await reopen(app);
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("Change the Status in Zoho first");
    await app.close();
  });

  it("needs a reason", async () => {
    const app = await buildApp("shop_admin");
    expect((await reopen(app, "")).statusCode).toBe(400);
    await app.close();
  });
});

describe("Dealt with", () => {
  for (const role of ALL_ROLES) {
    const allowed = role === "shop_admin" || role === "catalogue_editor";
    it(`${allowed ? "lets" : "stops"} ${role}`, async () => {
      const app = await buildApp(role);
      const response = await app.inject({
        method: "POST",
        url: `/admin/v1/artwork-register/attention/${ATTENTION_ID}/dealt-with`,
        headers: auth,
      });
      expect(response.statusCode).toBe(allowed ? 200 : 403);
      await app.close();
    });
  }
});

describe("Dealt with and Reopen need a recent sign-in", () => {
  const stale = Math.floor(Date.now() / 1000) - 60 * 60 * 24;

  it("refuses Reopen with step_up_required after a stale sign-in", async () => {
    const reopenSpy = vi.fn(reopened);
    const app = await buildApp("shop_admin", reopenSpy, stale);
    const response = await reopen(app);
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("shop.step_up_required");
    expect(reopenSpy).not.toHaveBeenCalled();
    await app.close();
  });

  it("refuses Dealt with with step_up_required after a stale sign-in", async () => {
    const app = await buildApp("catalogue_editor", reopened, stale);
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/artwork-register/attention/${ATTENTION_ID}/dealt-with`,
      headers: auth,
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("shop.step_up_required");
    await app.close();
  });
});
