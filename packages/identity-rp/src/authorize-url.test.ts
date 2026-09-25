import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "./authorize-url.js";
import { buildEndSessionUrl } from "./end-session-url.js";

describe("buildAuthorizeUrl", () => {
  it("builds a PKCE authorization request", () => {
    const href = buildAuthorizeUrl({
      authorizationEndpoint: "https://auth.example/authorize",
      clientId: "lax-bid-web",
      redirectUri: "https://test.lax.bid/api/auth/callback/lax-bid-web",
      scopes: ["openid", "offline_access"],
      state: "state-1",
      nonce: "nonce-1",
      codeChallenge: "challenge",
      prompt: "login",
    });
    const url = new URL(href);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("lax-bid-web");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("prompt")).toBe("login");
  });

  it("serializes prompt=create and max_age", () => {
    const href = buildAuthorizeUrl({
      authorizationEndpoint: "https://auth.example/authorize",
      clientId: "lax-bid-web",
      redirectUri: "https://test.lax.bid/api/auth/callback/lax-bid-web",
      scopes: ["openid"],
      state: "s",
      nonce: "n",
      codeChallenge: "c",
      prompt: "create",
      maxAge: 0,
    });
    const url = new URL(href);
    expect(url.searchParams.get("prompt")).toBe("create");
    expect(url.searchParams.get("max_age")).toBe("0");
  });
});

describe("buildEndSessionUrl", () => {
  it("includes logout hint parameters", () => {
    const href = buildEndSessionUrl({
      endSessionEndpoint: "https://auth.example/endsession",
      clientId: "lax-bid-web",
      postLogoutRedirectUri: "https://test.lax.bid/",
      idTokenHint: "id.jwt",
      state: "logout-state",
    });
    const url = new URL(href);
    expect(url.searchParams.get("id_token_hint")).toBe("id.jwt");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("https://test.lax.bid/");
    expect(url.searchParams.get("state")).toBe("logout-state");
  });
});
