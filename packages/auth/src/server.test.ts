import type { Database } from "@auction/db";
import { describe, expect, it } from "vitest";
import { createAuth, createSocialProviders } from "./server.js";

describe("createAuth", () => {
  it("boots when Apple Sign-In is feature-flagged off", () => {
    expect(() =>
      createAuth({
        db: {} as Database,
        secret: "test-secret-that-is-long-enough",
        baseURL: "http://localhost:3001",
        issuerURL: "http://localhost:3001",
        appleClientId: undefined,
        appleClientSecret: undefined,
      }),
    ).not.toThrow();
  });

  it("registers Google and Apple providers when credentials are configured", () => {
    expect(
      createSocialProviders({
        googleClientId: "google-client-id",
        googleClientSecret: "google-client-secret",
        appleClientId: "apple-client-id",
        appleClientSecret: "apple-client-secret",
      }),
    ).toEqual({
      google: {
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      },
      apple: {
        clientId: "apple-client-id",
        clientSecret: "apple-client-secret",
      },
    });
  });
});
