import type { ArtListingFacts } from "@auction/artwork-register-contracts";
import { describe, expect, it, vi } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const CLIENT_ID = "inventory-move";
const CLIENT_SECRET = "inventory-machine-secret-at-least-32-chars"; // gitleaks:allow
const URL = "/internal/inventory/art-listings/lookup";
const machine = { "x-inventory-client-id": CLIENT_ID, "x-inventory-client-secret": CLIENT_SECRET };

const LISTING: ArtListingFacts = {
  zohoProductId: "1023341000017963001",
  artworkId: "33333333-3333-4333-8333-333333333333",
  slug: "quiet-harbour",
  published: true,
  publishedAt: "2026-11-01T10:00:00.000Z",
  archived: false,
};

function app(
  credentials: { clientId?: string | undefined; clientSecret?: string | undefined } = {},
) {
  const findByZohoProductIds = vi.fn(async () => [LISTING]);
  const base = createMinimalShopApiTestDeps();
  const instance = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      inventory: {
        ...base.inventory,
        lookup: { findByZohoProductIds },
        machine: {
          clientId: "clientId" in credentials ? credentials.clientId : CLIENT_ID,
          clientSecret: "clientSecret" in credentials ? credentials.clientSecret : CLIENT_SECRET,
        },
      },
    }),
    logger: false,
  });
  return { instance, findByZohoProductIds };
}

const ask = (instance: ReturnType<typeof app>["instance"], payload: unknown, headers = machine) =>
  instance.inject({ method: "POST", url: URL, headers, payload: payload as object });

describe("internal inventory route: look up lax.art listings", () => {
  it("is closed until the credential is configured", async () => {
    const { instance } = app({ clientId: undefined, clientSecret: undefined });
    const response = await ask(instance, { zohoProductIds: [LISTING.zohoProductId] });
    expect(response.statusCode).toBe(503);
  });

  it("refuses a wrong credential without reading anything", async () => {
    const { instance, findByZohoProductIds } = app();
    const response = await ask(
      instance,
      { zohoProductIds: [LISTING.zohoProductId] },
      { ...machine, "x-inventory-client-secret": "x".repeat(40) },
    );
    expect(response.statusCode).toBe(401);
    expect(findByZohoProductIds).not.toHaveBeenCalled();
  });

  it("refuses an empty or oversized request", async () => {
    const { instance } = app();
    expect((await ask(instance, { zohoProductIds: [] })).statusCode).toBe(400);
    const tooMany = Array.from({ length: 101 }, (_, i) => `id-${i}`);
    expect((await ask(instance, { zohoProductIds: tooMany })).statusCode).toBe(400);
  });

  it("answers the listings it holds and is never cached", async () => {
    const { instance, findByZohoProductIds } = app();
    const response = await ask(instance, { zohoProductIds: [LISTING.zohoProductId, "other"] });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({ listings: [LISTING] });
    expect(findByZohoProductIds).toHaveBeenCalledWith([LISTING.zohoProductId, "other"]);
  });
});
