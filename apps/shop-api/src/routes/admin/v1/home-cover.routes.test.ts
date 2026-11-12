import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createInMemoryHomeCover } from "../../../test-support/in-memory-home-cover.js";

const KEY = "shop/artwork/a.jpg";
const headers = {
  authorization: "Bearer admin-token-placeholder-minimum-length",
  "idempotency-key": "99999999-9999-4999-8999-999999999999",
};
const body = { mediaKey: KEY, alt: "A river at dusk", focal: { x: 0.7, y: 0.4 } };

async function buildApp(role: ShopStaffRole) {
  vi.mocked(verifyBearerToken).mockReset();
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const store = createInMemoryHomeCover();
  store.addPicture(KEY);
  const base = createMinimalShopApiTestDeps();
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
      admin: { ...base.admin, homeCover: store.port },
    }),
    logger: false,
  });
  await app.ready();
  return { app, store };
}

type App = Awaited<ReturnType<typeof buildApp>>["app"];
const put = (app: App, payload: unknown = body) =>
  app.inject({ method: "PUT", url: "/admin/v1/home-cover", headers, payload });

describe("admin home cover routes", () => {
  it("lets editors choose the cover, audited, and shows it back", async () => {
    const { app, store } = await buildApp("editor");
    const response = await put(app);
    expect(response.statusCode).toBe(200);
    expect(response.json().cover).toMatchObject({
      mediaKey: KEY,
      alt: "A river at dusk",
      side: "left",
      tone: "light",
    });
    expect(store.audit).toHaveLength(1);

    const read = await app.inject({ method: "GET", url: "/admin/v1/home-cover", headers });
    expect(read.json().cover.mediaKey).toBe(KEY);
    expect(read.json().minimumWidth).toBe(2400);
  });

  it("lets any staff member read it but not change it", async () => {
    const { app, store } = await buildApp("read_only");
    const read = await app.inject({ method: "GET", url: "/admin/v1/home-cover", headers });
    expect(read.statusCode).toBe(200);
    expect((await put(app)).statusCode).toBe(403);
    expect(
      (await app.inject({ method: "DELETE", url: "/admin/v1/home-cover", headers })).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: "GET", url: "/admin/v1/home-cover/pictures", headers }))
        .statusCode,
    ).toBe(403);
    expect(store.state.saved).toBeNull();
  });

  it("names the fields at fault when a save is refused", async () => {
    const { app } = await buildApp("editor");
    const response = await put(app, { ...body, alt: " ", mediaKey: "shop/other.jpg" });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      issues: [{ field: "mediaKey", reason: "picture_unknown" }],
    });
  });

  it("removes the cover", async () => {
    const { app, store } = await buildApp("shop_admin");
    await put(app);
    const response = await app.inject({
      method: "DELETE",
      url: "/admin/v1/home-cover",
      headers: { ...headers, "idempotency-key": "88888888-8888-4888-8888-888888888888" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().cover).toBeNull();
    expect(store.state.saved).toBeNull();
  });

  it("requires an idempotency key to save", async () => {
    const { app } = await buildApp("editor");
    const { "idempotency-key": _omit, ...withoutKey } = headers;
    const response = await app.inject({
      method: "PUT",
      url: "/admin/v1/home-cover",
      headers: withoutKey,
      payload: body,
    });
    expect(response.statusCode).toBe(400);
  });
});
