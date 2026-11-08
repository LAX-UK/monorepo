import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createInMemoryDeliveryRegions } from "../../../test-support/in-memory-delivery-regions.js";

const headers = {
  authorization: "Bearer admin-token-placeholder-minimum-length",
  "idempotency-key": "99999999-9999-4999-8999-999999999999",
};

const euEdit = {
  standardMinDays: 8,
  standardMaxDays: 12,
  specialistMinDays: 14,
  specialistMaxDays: 24,
  fixedPricePence: null,
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
  const store = createInMemoryDeliveryRegions();
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
      admin: { ...base.admin, deliveryRegions: store.service },
    }),
    logger: false,
  });
  await app.ready();
  return { app, store };
}

type App = Awaited<ReturnType<typeof buildApp>>["app"];

const put = (
  app: App,
  url: string,
  payload: Record<string, unknown>,
  extra: Record<string, string> = {},
) =>
  app.inject({ method: "PUT", url: `/admin/v1${url}`, headers: { ...headers, ...extra }, payload });

describe("admin delivery region routes", () => {
  it("lets every staff member read the regions, with names and what is not delivered to", async () => {
    const { app } = await buildApp("operations");
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/delivery-regions",
      headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.regions.map((r: { id: string; name: string }) => [r.id, r.name])).toEqual([
      ["uk", "United Kingdom"],
      ["eu", "European Union"],
      ["north_america", "North America"],
      ["asia_pacific", "Asia Pacific"],
    ]);
    expect(body.regions[1]).toMatchObject({
      standard: { minDays: 10, maxDays: 15 },
      specialist: { minDays: 15, maxDays: 25 },
      fixedPricePence: null,
    });
    expect(body.regions[1].countries).toHaveLength(27);
    expect(body.notDeliveredTo.map((c: { name: string }) => c.name)).toEqual([
      "Belarus",
      "Iran",
      "North Korea",
      "Russia",
      "Syria",
    ]);
    expect(body.countryChoices.length).toBeGreaterThan(200);
    expect(body.countryChoices.some((c: { code: string }) => c.code === "GB")).toBe(false);
    await app.close();
  });

  it("lets staff with settings.write change a region, audited with the values before and after", async () => {
    const { app, store } = await buildApp("shop_admin");
    const response = await put(app, "/delivery-regions/eu", euEdit);
    expect(response.statusCode).toBe(200);
    expect(response.json().regions[1]).toMatchObject({
      standard: { minDays: 8, maxDays: 12 },
      specialist: { minDays: 14, maxDays: 24 },
    });
    expect(store.audit).toEqual([
      expect.objectContaining({
        actorSubjectId: "shop_admin-subject",
        capability: "settings.write",
        action: "delivery_regions.update_region",
        targetId: "eu",
        beforeJson: {
          standard: { minDays: 10, maxDays: 15 },
          specialist: { minDays: 15, maxDays: 25 },
          fixedPricePence: null,
        },
        afterJson: {
          standard: { minDays: 8, maxDays: 12 },
          specialist: { minDays: 14, maxDays: 24 },
          fixedPricePence: null,
        },
      }),
    ]);
    await app.close();
  });

  it("switches a region to a fixed price, and back to a quote", async () => {
    const { app } = await buildApp("shop_admin");
    const priced = await put(app, "/delivery-regions/eu", { ...euEdit, fixedPricePence: 4500 });
    expect(priced.json().regions[1].fixedPricePence).toBe(4500);
    const quoted = await put(app, "/delivery-regions/eu", euEdit, {
      "idempotency-key": "88888888-8888-4888-8888-888888888888",
    });
    expect(quoted.json().regions[1].fixedPricePence).toBeNull();
    await app.close();
  });

  it("refuses staff without settings.write, changing nothing", async () => {
    const { app, store } = await buildApp("operations");
    expect((await put(app, "/delivery-regions/eu", euEdit)).statusCode).toBe(403);
    expect(
      (await put(app, "/delivery-regions/not-delivered-to", { countries: [] })).statusCode,
    ).toBe(403);
    expect(store.saves).toEqual([]);
    expect(store.audit).toEqual([]);
    await app.close();
  });

  it("refuses a minimum above the maximum and names the field", async () => {
    const { app, store } = await buildApp("shop_admin");
    const response = await put(app, "/delivery-regions/eu", {
      ...euEdit,
      standardMinDays: 20,
      standardMaxDays: 10,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "shop.validation",
      issues: [{ field: "standardMinDays", reason: "min_above_max" }],
    });
    expect(store.saves).toEqual([]);
    await app.close();
  });

  it("will not change the UK's price while checkout charges its own", async () => {
    const { app, store } = await buildApp("shop_admin");
    const response = await put(app, "/delivery-regions/uk", {
      standardMinDays: 5,
      standardMaxDays: 10,
      specialistMinDays: 10,
      specialistMaxDays: 20,
      fixedPricePence: null,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().issues).toEqual([
      { field: "fixedPricePence", reason: "uk_price_is_set_in_checkout" },
    ]);
    expect(store.saves).toEqual([]);
    await app.close();
  });

  it("refuses an unknown region and a missing idempotency key", async () => {
    const { app } = await buildApp("shop_admin");
    expect((await put(app, "/delivery-regions/mars", euEdit)).statusCode).toBe(400);
    const noKey = await app.inject({
      method: "PUT",
      url: "/admin/v1/delivery-regions/eu",
      headers: { authorization: headers.authorization },
      payload: euEdit,
    });
    expect(noKey.statusCode).toBe(400);
    await app.close();
  });

  it("replays a repeated key without changing the region twice", async () => {
    const { app, store } = await buildApp("shop_admin");
    await put(app, "/delivery-regions/eu", euEdit);
    await put(app, "/delivery-regions/eu", euEdit);
    expect(store.saves).toHaveLength(1);
    await app.close();
  });

  it("replaces the countries not delivered to, sorted, audited, and refuses the UK and strangers", async () => {
    const { app, store } = await buildApp("shop_admin");
    const saved = await put(app, "/delivery-regions/not-delivered-to", {
      countries: ["SY", "AF", "RU"],
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().notDeliveredTo.map((c: { code: string }) => c.code)).toEqual([
      "AF",
      "RU",
      "SY",
    ]);
    expect(store.audit[0]).toMatchObject({
      action: "delivery_regions.replace_restricted",
      beforeJson: { countries: ["BY", "IR", "KP", "RU", "SY"] },
      afterJson: { countries: ["AF", "RU", "SY"] },
    });
    const refused = await put(
      app,
      "/delivery-regions/not-delivered-to",
      { countries: ["GB", "XX"] },
      { "idempotency-key": "77777777-7777-4777-8777-777777777777" },
    );
    expect(refused.statusCode).toBe(400);
    expect(refused.json().issues).toEqual([
      { code: "GB", reason: "united_kingdom" },
      { code: "XX", reason: "unknown_country" },
    ]);
    await app.close();
  });

  it("lets staff clear the list, so every country is offered a delivery", async () => {
    const { app } = await buildApp("shop_admin");
    const cleared = await put(app, "/delivery-regions/not-delivered-to", { countries: [] });
    expect(cleared.json().notDeliveredTo).toEqual([]);
    await app.close();
  });
});
