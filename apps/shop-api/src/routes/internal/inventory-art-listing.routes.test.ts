import { describe, expect, it, vi } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const CLIENT_ID = "inventory-move";
const CLIENT_SECRET = "inventory-machine-secret-at-least-32-chars";
const URL = "/internal/inventory/art-listings/reopen";
const body = { registerId: "22222222-2222-4222-8222-222222222222", actor: "staff:user-1" };
const machine = { "x-inventory-client-id": CLIENT_ID, "x-inventory-client-secret": CLIENT_SECRET };

function app(
  reopen = vi.fn(async () => ({
    ok: true as const,
    data: { artworkId: "33333333-3333-4333-8333-333333333333", reopened: true },
  })),
  credentials: { clientId?: string; clientSecret?: string } = {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  },
) {
  const instance = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      inventory: {
        reopen: { reopen },
        lookup: { findByZohoProductIds: async () => [] },
        machine: { clientId: credentials.clientId, clientSecret: credentials.clientSecret },
      },
    }),
    logger: false,
  });
  return { instance, reopen };
}

describe("internal inventory route: reopen a lax.art listing", () => {
  it("is closed until the credential is configured", async () => {
    const { instance } = app(undefined, {});
    const response = await instance.inject({
      method: "POST",
      url: URL,
      headers: machine,
      payload: body,
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: "not_configured" });
  });

  it("refuses a missing or wrong credential", async () => {
    const { instance, reopen } = app();
    expect((await instance.inject({ method: "POST", url: URL, payload: body })).statusCode).toBe(
      401,
    );
    const wrong = await instance.inject({
      method: "POST",
      url: URL,
      headers: { ...machine, "x-inventory-client-secret": "x".repeat(40) },
      payload: body,
    });
    expect(wrong.statusCode).toBe(401);
    expect(reopen).not.toHaveBeenCalled();
  });

  it("reopens the listing and answers in the contract's shape", async () => {
    const { instance, reopen } = app();
    const response = await instance.inject({
      method: "POST",
      url: URL,
      headers: machine,
      payload: body,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      artworkId: "33333333-3333-4333-8333-333333333333",
      reopened: true,
    });
    expect(reopen).toHaveBeenCalledWith(body);
  });

  it("rejects a request that is not a staff action", async () => {
    const { instance, reopen } = app();
    const response = await instance.inject({
      method: "POST",
      url: URL,
      headers: machine,
      payload: { ...body, actor: "system" },
    });
    expect(response.statusCode).toBe(400);
    expect(reopen).not.toHaveBeenCalled();
  });

  it("passes a refusal on with its reason", async () => {
    const { instance } = app(
      vi.fn(async () => ({
        ok: false as const,
        status: 409 as const,
        refusal: { error: "no_listing" as const, message: "There is no lax.art record yet." },
      })) as never,
    );
    const response = await instance.inject({
      method: "POST",
      url: URL,
      headers: machine,
      payload: body,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "no_listing",
      message: "There is no lax.art record yet.",
    });
  });
});
