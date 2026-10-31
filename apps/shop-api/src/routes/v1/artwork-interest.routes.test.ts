import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "collector-1",
    payload: { scope: "shop.read shop.write" },
  })),
}));

import { createShopApiApp } from "../../app.js";
import {
  type EnquiryRateLimiter,
  createEnquiryRateLimiter,
} from "../../application/enquiry-rate-limit.js";
import { createInMemoryFixedWindowCounter } from "../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const userHeaders = { authorization: "Bearer user-token" };
const bffHeaders = { authorization: "Bearer test-bff-token-minimum-32-characters-long" };
const ACCOUNT = {
  kind: "account",
  identitySubjectId: "collector-1",
  contactName: null,
  contactEmail: null,
} as const;
const GUEST_CONTACT = { name: "Grace Hopper", email: "grace@example.com" };

async function buildApp(
  registerArtworkInterest = vi.fn(async () => ({
    status: "registered" as const,
    reference: "E-2041",
  })),
  enquiryRateLimiter: EnquiryRateLimiter = createEnquiryRateLimiter(
    createInMemoryFixedWindowCounter(),
  ),
) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      interest: { ...base.interest, registerArtworkInterest, enquiryRateLimiter },
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
    expect(response.json()).toEqual({ status: "registered", reference: "E-2041" });
    expect(registerArtworkInterest).toHaveBeenCalledWith({
      artworkSlug: "test-slug",
      sender: ACCOUNT,
      intent: "enquiry",
      message: "Is this still available?",
      contactPhone: "+44 20 7946 0000",
    });
    await app.close();
  });

  it("hands notify_me requests to edition alerts, not to the enquiry inbox", async () => {
    const { app, registerArtworkInterest } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: userHeaders,
      payload: { intent: "notify_me", message: "ignored", contactPhone: "+44 20 7946 0000" },
    });
    expect(response.statusCode).toBe(200);
    expect(registerArtworkInterest).not.toHaveBeenCalled();
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

  it("links a signed-in enquiry to the account and keeps the edited contact details", async () => {
    const { app, registerArtworkInterest } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: userHeaders,
      payload: { intent: "enquiry", name: " Ada L ", email: "ada@work.example" },
    });
    expect(response.statusCode).toBe(200);
    expect(registerArtworkInterest).toHaveBeenCalledWith({
      artworkSlug: "test-slug",
      sender: {
        kind: "account",
        identitySubjectId: "collector-1",
        contactName: "Ada L",
        contactEmail: "ada@work.example",
      },
      intent: "enquiry",
    });
    await app.close();
  });

  it("accepts a guest enquiry through the BFF with name and email", async () => {
    const { app, registerArtworkInterest } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: bffHeaders,
      payload: { intent: "enquiry", ...GUEST_CONTACT, message: "Is it framed?" },
    });
    expect(response.statusCode).toBe(200);
    expect(registerArtworkInterest).toHaveBeenCalledWith({
      artworkSlug: "test-slug",
      sender: { kind: "guest", contactName: "Grace Hopper", contactEmail: "grace@example.com" },
      intent: "enquiry",
      message: "Is it framed?",
    });
    await app.close();
  });

  it.each([
    ["no name", { email: "grace@example.com" }, 400],
    ["no email", { name: "Grace" }, 400],
    ["an invalid email", { name: "Grace", email: "grace@" }, 400],
    ["an email over 254 characters", { name: "Grace", email: `${"g".repeat(250)}@x.io` }, 400],
    ["a name over 120 characters", { name: "G".repeat(121), email: "grace@example.com" }, 400],
  ])("rejects a guest enquiry with %s", async (_label, contact, status) => {
    const { app, registerArtworkInterest } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: bffHeaders,
      payload: { intent: "enquiry", ...contact },
    });
    expect(response.statusCode).toBe(status);
    expect(registerArtworkInterest).not.toHaveBeenCalled();
    await app.close();
  });

  it("answers a honeypot submission as success without storing it", async () => {
    const { app, registerArtworkInterest } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: bffHeaders,
      payload: { intent: "enquiry", ...GUEST_CONTACT, website: "https://spam.example" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "registered" });
    expect(registerArtworkInterest).not.toHaveBeenCalled();
    await app.close();
  });

  it("rate-limits by sender email and by the client IP the BFF forwards", async () => {
    const consume = vi.fn<EnquiryRateLimiter["consume"]>(async () => ({
      allowed: false,
      retryAfterSeconds: 120,
    }));
    const { app, registerArtworkInterest } = await buildApp(undefined, { consume });
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: { ...bffHeaders, "x-lax-client-ip": "203.0.113.9" },
      payload: { intent: "enquiry", ...GUEST_CONTACT, email: "Grace@Example.com" },
    });
    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("120");
    expect(response.json()).toMatchObject({ code: "shop.rate_limited" });
    expect(consume).toHaveBeenCalledWith({
      clientIp: "203.0.113.9",
      senderKey: "email:grace@example.com",
    });
    expect(registerArtworkInterest).not.toHaveBeenCalled();
    await app.close();
  });

  it("blocks the sixth enquiry from one email within the hour", async () => {
    const { app, registerArtworkInterest } = await buildApp();
    const send = () =>
      app.inject({
        method: "POST",
        url: "/v1/artworks/test-slug/interest",
        headers: bffHeaders,
        payload: { intent: "enquiry", ...GUEST_CONTACT },
      });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await send()).statusCode).toBe(200);
    }
    expect((await send()).statusCode).toBe(429);
    expect(registerArtworkInterest).toHaveBeenCalledTimes(5);
    await app.close();
  });

  it("ignores the forwarded client IP on user tokens, so it cannot choose a bucket", async () => {
    const consume = vi.fn<EnquiryRateLimiter["consume"]>(async () => ({ allowed: true }));
    const { app } = await buildApp(undefined, { consume });
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: { ...userHeaders, "x-lax-client-ip": "203.0.113.9" },
      payload: { intent: "enquiry" },
    });
    expect(response.statusCode).toBe(200);
    expect(consume).toHaveBeenCalledWith(expect.objectContaining({ clientIp: null }));
    await app.close();
  });

  it("falls back to the socket address when the forwarded IP is missing or not an address", async () => {
    const consume = vi.fn<EnquiryRateLimiter["consume"]>(async () => ({ allowed: true }));
    const { app } = await buildApp(undefined, { consume });
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: { ...bffHeaders, "x-lax-client-ip": "not-an-ip" },
      payload: { intent: "enquiry", ...GUEST_CONTACT },
    });
    expect(response.statusCode).toBe(200);
    expect(consume).toHaveBeenCalledWith(expect.objectContaining({ clientIp: "127.0.0.1" }));
    await app.close();
  });

  it("sends the enquiry when the rate-limit store is unavailable", async () => {
    const consume = vi.fn<EnquiryRateLimiter["consume"]>(async () => {
      throw new Error("redis down");
    });
    const { app, registerArtworkInterest } = await buildApp(undefined, { consume });
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: bffHeaders,
      payload: { intent: "enquiry", ...GUEST_CONTACT },
    });
    expect(response.statusCode).toBe(200);
    expect(registerArtworkInterest).toHaveBeenCalledOnce();
    await app.close();
  });
});
