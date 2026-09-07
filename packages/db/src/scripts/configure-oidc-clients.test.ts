import { describe, expect, it } from "vitest";
import {
  assertBackchannelLogoutUriAllowed,
  buildOidcClientMetadata,
  hashOidcClientSecret,
} from "./configure-oidc-clients.js";

describe("OIDC client provisioning", () => {
  it("uses Better Auth's SHA-256 base64url client-secret format", () => {
    expect(hashOidcClientSecret("client-secret")).toBe(
      "_c6OSmW3DRhr13y6LgxYDc8cZJfanxtw7thJSX4fi6I",
    );
  });

  it("persists resource and scope policy for the promoted Shop client", () => {
    expect(JSON.parse(buildOidcClientMetadata("lax-shop-web"))).toEqual({
      allowedScopes: ["openid", "profile", "email", "offline_access", "shop.read", "shop.write"],
      allowedResources: ["lax-shop-api"],
      pkceRequired: true,
      postLogoutRedirectUris: [
        "http://localhost:3010/",
        "https://shop.lax.art/",
        "https://test-shop.lax.art/",
      ],
      backchannelLogoutUri: "https://shop.lax.art/api/auth/backchannel-logout",
      backchannelLogoutSessionRequired: true,
    });
    expect(JSON.parse(buildOidcClientMetadata("lax-shop-web", "test")).backchannelLogoutUri).toBe(
      "https://test-shop.lax.art/api/auth/backchannel-logout",
    );
  });

  it("requires HTTPS in production and permits localhost HTTP only in development", () => {
    expect(() =>
      assertBackchannelLogoutUriAllowed("http://localhost:3010/api/auth/backchannel-logout", false),
    ).not.toThrow();
    expect(() =>
      assertBackchannelLogoutUriAllowed("http://localhost:3010/api/auth/backchannel-logout", true),
    ).toThrow(/HTTPS/);
    expect(() =>
      assertBackchannelLogoutUriAllowed("http://shop.lax.art/api/auth/backchannel-logout", false),
    ).toThrow(/HTTPS/);
  });
});
