import {
  deletionEligibilityPath,
  productDeletionEligibilitySchema,
} from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "api-service";
const CLIENT_SECRET = "identity-machine-secret-at-least-32-characters";
const BLOCKER = {
  code: "shop_open_orders",
  message: "You have 1 order that hasn't been paid for or delivered yet.",
  href: "https://shop.example/account/orders",
};

const machine = { "x-identity-client-id": CLIENT_ID, "x-identity-client-secret": CLIENT_SECRET };

function app(
  listBlockers = vi.fn(async (_subjectId: string) => [BLOCKER]),
  credentials: { clientId?: string; clientSecret?: string } = {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  },
) {
  const instance = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      identityDeletion: {
        eligibility: { listBlockers },
        machine: { clientId: credentials.clientId, clientSecret: credentials.clientSecret },
      },
    }),
    logger: false,
  });
  return { instance, listBlockers };
}

describe("internal Identity deletion-eligibility route (Shop)", () => {
  it("answers for the product with its blockers, in the contract's shape", async () => {
    const { instance, listBlockers } = app();
    const response = await instance.inject({
      method: "GET",
      url: deletionEligibilityPath(SUBJECT),
      headers: machine,
    });
    expect(response.statusCode).toBe(200);
    expect(productDeletionEligibilitySchema.parse(response.json())).toEqual({
      product: "shop",
      blockers: [BLOCKER],
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(listBlockers).toHaveBeenCalledWith(SUBJECT);
  });

  it("answers with no blockers when nothing is in the way", async () => {
    const { instance } = app(vi.fn(async () => []));
    const response = await instance.inject({
      method: "GET",
      url: deletionEligibilityPath(SUBJECT),
      headers: machine,
    });
    expect(response.json()).toEqual({ product: "shop", blockers: [] });
  });

  it.each([
    ["no credentials", {}],
    ["the wrong id", { ...machine, "x-identity-client-id": "someone-else" }],
    ["the wrong secret", { ...machine, "x-identity-client-secret": "wrong-secret" }],
    ["a user's bearer token", { authorization: "Bearer a-users-access-token" }],
  ])("refuses a caller with %s without reading anything", async (_label, headers) => {
    const { instance, listBlockers } = app();
    const response = await instance.inject({
      method: "GET",
      url: deletionEligibilityPath(SUBJECT),
      headers,
    });
    expect(response.statusCode).toBe(401);
    expect(listBlockers).not.toHaveBeenCalled();
  });

  it("is closed, not open, when the machine client is not configured", async () => {
    const { instance, listBlockers } = app(undefined, {});
    const response = await instance.inject({
      method: "GET",
      url: deletionEligibilityPath(SUBJECT),
      headers: machine,
    });
    expect(response.statusCode).toBe(503);
    expect(listBlockers).not.toHaveBeenCalled();
  });

  it("answers 503, never an empty list, when the data cannot be read", async () => {
    const { instance } = app(vi.fn().mockRejectedValue(new Error("database down")));
    const response = await instance.inject({
      method: "GET",
      url: deletionEligibilityPath(SUBJECT),
      headers: machine,
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "deletion_eligibility_unavailable" });
  });
});
