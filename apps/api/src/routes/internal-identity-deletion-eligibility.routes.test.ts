import {
  deletionEligibilityPath,
  productDeletionEligibilitySchema,
} from "@auction/identity-contracts";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createInternalIdentityDeletionEligibilityRoutes } from "./internal-identity-deletion-eligibility.routes.js";

vi.mock("@auction/observability", () => ({ Sentry: { captureException: vi.fn() } }));

const credentials = {
  IDENTITY_MACHINE_CLIENT_ID: "auth-service",
  IDENTITY_MACHINE_CLIENT_SECRET: "identity-machine-secret-at-least-32-characters",
};
const SUBJECT = "11111111-1111-4111-8111-111111111111";
const BLOCKER = { code: "pay", message: "Pay it.", href: "https://bid.example/dashboard/payments" };

function authHeaders() {
  return {
    "x-identity-client-id": credentials.IDENTITY_MACHINE_CLIENT_ID,
    "x-identity-client-secret": credentials.IDENTITY_MACHINE_CLIENT_SECRET,
  };
}

function createApp(listBlockers = vi.fn().mockResolvedValue([BLOCKER])) {
  const app = new Hono().route(
    "/internal/identity",
    createInternalIdentityDeletionEligibilityRoutes(
      { accountDeletionEligibilityService: { listBlockers } as never },
      credentials,
    ),
  );
  return { app, listBlockers };
}

describe("internal Identity deletion-eligibility route (Bid)", () => {
  it("is served at the path Identity calls, from the shared contract", async () => {
    const { app } = createApp();
    const response = await app.request(deletionEligibilityPath(SUBJECT), {
      headers: authHeaders(),
    });
    expect(response.status).toBe(200);
  });

  it("answers for the product with its blockers, in the contract's shape", async () => {
    const { app, listBlockers } = createApp();
    const response = await app.request(deletionEligibilityPath(SUBJECT), {
      headers: authHeaders(),
    });
    const body = await response.json();
    expect(productDeletionEligibilitySchema.parse(body)).toEqual({
      product: "bid",
      blockers: [BLOCKER],
    });
    expect(listBlockers).toHaveBeenCalledWith(SUBJECT);
  });

  it("answers with no blockers when nothing is in the way", async () => {
    const { app } = createApp(vi.fn().mockResolvedValue([]));
    const response = await app.request(deletionEligibilityPath(SUBJECT), {
      headers: authHeaders(),
    });
    expect(await response.json()).toEqual({ product: "bid", blockers: [] });
  });

  it("is not available without configured machine credentials", async () => {
    const app = new Hono().route(
      "/internal/identity",
      createInternalIdentityDeletionEligibilityRoutes(
        { accountDeletionEligibilityService: { listBlockers: vi.fn() } as never },
        { IDENTITY_MACHINE_CLIENT_ID: undefined, IDENTITY_MACHINE_CLIENT_SECRET: undefined },
      ),
    );
    expect((await app.request(deletionEligibilityPath(SUBJECT))).status).toBe(503);
  });

  it.each([
    ["no credentials", {}],
    ["the wrong id", { ...authHeaders(), "x-identity-client-id": "someone-else" }],
    ["the wrong secret", { ...authHeaders(), "x-identity-client-secret": "wrong-secret" }],
  ])("refuses a caller with %s without reading anything", async (_label, headers) => {
    const { app, listBlockers } = createApp();
    const response = await app.request(deletionEligibilityPath(SUBJECT), { headers });
    expect(response.status).toBe(401);
    expect(listBlockers).not.toHaveBeenCalled();
  });

  it("answers 503, never an empty list, when the data cannot be read", async () => {
    const { app } = createApp(vi.fn().mockRejectedValue(new Error("database down")));
    const response = await app.request(deletionEligibilityPath(SUBJECT), {
      headers: authHeaders(),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "deletion_eligibility_unavailable" });
  });
});
