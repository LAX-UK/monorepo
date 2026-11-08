import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import {
  OAK_PRICES,
  createInMemoryFraming,
  seededOption,
} from "../../../test-support/in-memory-framing.js";

const OAK = "00000000-0000-4000-8000-0000000000a1";
const headers = {
  authorization: "Bearer admin-token-placeholder-minimum-length",
  "idempotency-key": "99999999-9999-4999-8999-999999999999",
};

const validBody = {
  name: "Walnut frame",
  frame: "natural_oak",
  mount: "window_conservation",
  glazing: "uv_acrylic",
  hanging: "d_rings_cord",
  leadTimeMinDays: 15,
  leadTimeMaxDays: 20,
  pricesPence: { up_to_40x50: 16000, up_to_60x80: 25000, up_to_80x100: 32500 },
  offered: false,
};

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
  const store = createInMemoryFraming({
    options: [seededOption({ id: OAK, pricesPence: OAK_PRICES })],
  });
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
      admin: { ...base.admin, framing: store.service },
    }),
    logger: false,
  });
  await app.ready();
  return { app, store };
}

const list = (app: Awaited<ReturnType<typeof buildApp>>["app"]) =>
  app.inject({ method: "GET", url: "/admin/v1/framing-options", headers });

describe("admin framing routes", () => {
  it("lists the catalogue for anyone who can open the catalogue", async () => {
    const { app } = await buildApp("read_only");
    const response = await list(app);
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([
      expect.objectContaining({
        id: OAK,
        code: "natural-oak",
        status: "draft",
        pricesPlaceholder: true,
        editionCount: 0,
        pricesPence: OAK_PRICES,
        version: "2026-11-01T09:00:00.000Z",
      }),
    ]);
    await app.close();
  });

  it("keeps staff who cannot open the catalogue out", async () => {
    const { app } = await buildApp("broker");
    expect((await list(app)).statusCode).toBe(403);
    await app.close();
  });

  it("lets a catalogue editor add an option", async () => {
    const { app, store } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/framing-options",
      headers,
      payload: validBody,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ code: "walnut-frame", status: "draft" });
    expect(store.audit).toEqual([
      expect.objectContaining({
        actorSubjectId: "catalogue_editor-subject",
        capability: "catalogue.write",
        action: "framing.create",
      }),
    ]);
    await app.close();
  });

  it("refuses writes from staff who can only read", async () => {
    const { app, store } = await buildApp("read_only");
    const created = await app.inject({
      method: "POST",
      url: "/admin/v1/framing-options",
      headers,
      payload: validBody,
    });
    const offered = await app.inject({
      method: "PUT",
      url: `/admin/v1/framing-options/${OAK}/offered`,
      headers,
      payload: { offered: false, expectedVersion: "2026-11-01T09:00:00.000Z" },
    });
    expect([created.statusCode, offered.statusCode]).toEqual([403, 403]);
    expect(store.audit).toEqual([]);
    await app.close();
  });

  it("names each field at fault when an option cannot be saved", async () => {
    const { app } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/framing-options",
      headers,
      payload: {
        ...validBody,
        leadTimeMaxDays: null,
        pricesPence: { ...validBody.pricesPence, up_to_60x80: null },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "shop.validation",
      issues: [
        { field: "leadTimeMaxDays", reason: "lead_time_max_invalid" },
        { field: "price:up_to_60x80", reason: "price_missing" },
      ],
    });
    await app.close();
  });

  it("will not offer placeholder prices, and says which switch", async () => {
    const { app } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "PUT",
      url: `/admin/v1/framing-options/${OAK}/offered`,
      headers,
      payload: { offered: true, expectedVersion: "2026-11-01T09:00:00.000Z" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      issues: [{ field: "offered", reason: "placeholder_prices" }],
    });
    await app.close();
  });

  it("refuses a save from an older version with the current one", async () => {
    const { app } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "PUT",
      url: `/admin/v1/framing-options/${OAK}`,
      headers,
      payload: { ...validBody, expectedVersion: "2026-10-01T00:00:00.000Z" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ currentVersion: "2026-11-01T09:00:00.000Z" });
    await app.close();
  });

  it("updates an option and returns it with its new version", async () => {
    const { app } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "PUT",
      url: `/admin/v1/framing-options/${OAK}`,
      headers,
      payload: {
        ...validBody,
        name: "Natural oak frame",
        pricesPence: { ...OAK_PRICES, up_to_60x80: 21000 },
        expectedVersion: "2026-11-01T09:00:00.000Z",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      pricesPlaceholder: false,
      version: "2026-11-02T12:00:00.000Z",
    });
    await app.close();
  });

  it("refuses an id that is not a uuid, a missing key and an unknown option", async () => {
    const { app } = await buildApp("shop_admin");
    const badId = await app.inject({
      method: "PUT",
      url: "/admin/v1/framing-options/not-a-uuid/offered",
      headers,
      payload: { offered: false, expectedVersion: "2026-11-01T09:00:00.000Z" },
    });
    expect(badId.statusCode).toBe(400);
    const noKey = await app.inject({
      method: "POST",
      url: "/admin/v1/framing-options",
      headers: { authorization: headers.authorization },
      payload: validBody,
    });
    expect(noKey.statusCode).toBe(400);
    const unknown = await app.inject({
      method: "PUT",
      url: "/admin/v1/framing-options/00000000-0000-4000-8000-0000000000ff/offered",
      headers,
      payload: { offered: false, expectedVersion: "2026-11-01T09:00:00.000Z" },
    });
    expect(unknown.statusCode).toBe(404);
    await app.close();
  });
});
