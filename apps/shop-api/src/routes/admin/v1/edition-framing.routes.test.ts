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
  BLACK,
  OAK,
  createInMemoryEditionFraming,
  liveOption,
} from "../../../test-support/in-memory-edition-framing.js";

const ARTWORK = "00000000-0000-4000-8000-0000000000b1";
const headers = {
  authorization: "Bearer admin-token-placeholder-minimum-length",
  "idempotency-key": "99999999-9999-4999-8999-999999999999",
};
const url = `/admin/v1/artworks/${ARTWORK}/framing`;

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
  const store = createInMemoryEditionFraming({
    catalogue: [liveOption(OAK, { name: "Natural oak frame" }), liveOption(BLACK)],
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
      admin: { ...base.admin, editionFraming: store.service },
    }),
    logger: false,
  });
  await app.ready();
  return { app, store };
}

const body = (overrides: Record<string, unknown> = {}) => ({
  mode: "unframed_or_framed",
  framedByArtist: "",
  offers: [{ optionId: OAK, overridePence: null }],
  expectedVersion: null,
  ...overrides,
});

describe("admin edition framing routes", () => {
  it("lets anyone who can open the catalogue read an edition's framing", async () => {
    const { app } = await buildApp("read_only");
    const response = await app.inject({ method: "GET", url, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      artworkId: ARTWORK,
      band: "up_to_60x80",
      options: expect.arrayContaining([expect.objectContaining({ optionId: OAK, offered: false })]),
    });
    await app.close();
  });

  it("keeps staff who cannot open the catalogue out", async () => {
    const { app } = await buildApp("broker");
    expect((await app.inject({ method: "GET", url, headers })).statusCode).toBe(403);
    await app.close();
  });

  it("lets a catalogue editor offer options, audited", async () => {
    const { app, store } = await buildApp("catalogue_editor");
    const response = await app.inject({ method: "PUT", url, headers, payload: body() });
    expect(response.statusCode).toBe(200);
    expect(response.json().options[0]).toMatchObject({ optionId: OAK, offered: true });
    expect(store.audit).toEqual([
      expect.objectContaining({
        actorSubjectId: "catalogue_editor-subject",
        action: "edition_framing.save",
      }),
    ]);
    await app.close();
  });

  it("refuses an edition price from a catalogue editor, who may not set prices", async () => {
    const { app, store } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "PUT",
      url,
      headers,
      payload: body({ offers: [{ optionId: OAK, overridePence: 21000 }] }),
    });
    expect(response.statusCode).toBe(403);
    expect(store.audit).toEqual([]);
    await app.close();
  });

  it("lets an administrator set an edition's own price", async () => {
    const { app } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "PUT",
      url,
      headers,
      payload: body({ offers: [{ optionId: OAK, overridePence: 21000 }] }),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().options[0]).toMatchObject({ overridePence: 21000 });
    await app.close();
  });

  it("refuses writes from staff who can only read", async () => {
    const { app } = await buildApp("read_only");
    expect((await app.inject({ method: "PUT", url, headers, payload: body() })).statusCode).toBe(
      403,
    );
    await app.close();
  });

  it("names what is wrong when framing cannot be saved", async () => {
    const { app } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "PUT",
      url,
      headers,
      payload: body({ mode: "framed_only", offers: [] }),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "shop.validation",
      issues: [{ field: "offers", reason: "framed_only_needs_option" }],
    });
    await app.close();
  });

  it("refuses a save from an older version with the current one", async () => {
    const { app } = await buildApp("shop_admin");
    await app.inject({ method: "PUT", url, headers, payload: body() });
    const response = await app.inject({
      method: "PUT",
      url,
      headers: { ...headers, "idempotency-key": "11111111-1111-4111-8111-111111111111" },
      payload: body({ expectedVersion: "2026-10-01T00:00:00.000Z" }),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ currentVersion: "2026-11-02T12:00:00.000Z" });
    await app.close();
  });

  it("validates the ids, the key and the body shape", async () => {
    const { app } = await buildApp("shop_admin");
    expect(
      (await app.inject({ method: "GET", url: "/admin/v1/artworks/nope/framing", headers }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "PUT",
          url,
          headers: { authorization: headers.authorization },
          payload: body(),
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ method: "PUT", url, headers, payload: body({ mode: "sideways" }) }))
        .statusCode,
    ).toBe(400);
    await app.close();
  });
});
