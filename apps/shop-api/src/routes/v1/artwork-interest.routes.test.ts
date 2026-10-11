import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "collector-1",
    payload: { scope: "shop.read shop.write" },
  })),
}));

import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const userHeaders = { authorization: "Bearer user-token" };

async function buildApp(registerArtworkInterest = vi.fn(async () => "registered" as const)) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      interest: { ...base.interest, registerArtworkInterest },
    }),
    logger: false,
  });
  await app.ready();
  return { app, registerArtworkInterest };
}

describe("artwork interest routes", () => {
  it("requires auth for interest registration", async () => {
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps(),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      payload: {},
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects BFF-only tokens because interest requires a user subject", async () => {
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps(),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: {
        authorization: "Bearer test-bff-token-minimum-32-characters-long",
      },
      payload: {},
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("passes enquiry message and contact phone to the handler", async () => {
    const { app, registerArtworkInterest } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: userHeaders,
      payload: {
        intent: "enquiry",
        message: "Is this still available?",
        contactPhone: "+44 20 7946 0000",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "registered" });
    expect(registerArtworkInterest).toHaveBeenCalledWith({
      artworkSlug: "test-slug",
      identitySubjectId: "collector-1",
      intent: "enquiry",
      message: "Is this still available?",
      contactPhone: "+44 20 7946 0000",
    });
    await app.close();
  });

  it("drops message and phone for notify_me interest", async () => {
    const { app, registerArtworkInterest } = await buildApp();
    await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: userHeaders,
      payload: { intent: "notify_me", message: "ignored", contactPhone: "+44 20 7946 0000" },
    });
    expect(registerArtworkInterest).toHaveBeenCalledWith({
      artworkSlug: "test-slug",
      identitySubjectId: "collector-1",
      intent: "notify_me",
    });
    await app.close();
  });

  it.each([
    ["message over 2000 characters", { message: "x".repeat(2001) }],
    ["empty message", { message: "" }],
    ["phone with letters", { contactPhone: "call-me-maybe" }],
    ["phone too short", { contactPhone: "12345" }],
    ["phone too long", { contactPhone: "+1234567890123456789012" }],
  ])("rejects an enquiry with %s", async (_label, extra) => {
    const { app, registerArtworkInterest } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: userHeaders,
      payload: { intent: "enquiry", ...extra },
    });
    expect(response.statusCode).toBe(400);
    expect(registerArtworkInterest).not.toHaveBeenCalled();
    await app.close();
  });

  it("accepts a message of exactly 2000 characters", async () => {
    const { app } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: userHeaders,
      payload: { intent: "enquiry", message: "x".repeat(2000) },
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});
