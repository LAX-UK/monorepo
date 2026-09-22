import { describe, expect, it } from "vitest";
import { parseHostedAuthFlow, productHintHref } from "./flow-context.js";

const shopAuthorize = {
  response_type: "code",
  client_id: "lax-shop-web",
  redirect_uri: "http://localhost:3010/auth/callback",
  scope: "openid profile email",
  state: "state-1",
  nonce: "nonce-1",
  code_challenge: "challenge",
  code_challenge_method: "S256",
};

describe("parseHostedAuthFlow", () => {
  it("resumes a validated Shop authorization request", () => {
    const flow = parseHostedAuthFlow(new URLSearchParams(shopAuthorize));
    expect(flow.product).toBe("shop");
    expect(flow.clientId).toBe("lax-shop-web");
    expect(flow.authorizeResumePath).toMatch(/^\/api\/auth\/oauth2\/authorize\?/);
    const resume = new URL(flow.authorizeResumePath ?? "", "http://issuer.test");
    expect(resume.searchParams.get("client_id")).toBe("lax-shop-web");
    expect(resume.searchParams.get("response_type")).toBe("code");
    expect(resume.searchParams.get("redirect_uri")).toBe("http://localhost:3010/auth/callback");
    expect(resume.searchParams.get("code_challenge_method")).toBe("S256");
    expect(resume.searchParams.get("callbackURL")).toBeNull();
    expect(flow.allowedRedirectOrigins).toContain("http://localhost:3010");
  });

  it("drops untrusted callbackURL and returnTo values", () => {
    const flow = parseHostedAuthFlow(
      new URLSearchParams({
        ...shopAuthorize,
        callbackURL: "https://evil.example/steal",
        returnTo: "https://evil.example",
      }),
    );
    expect(flow.continuationQuery).not.toContain("callbackURL");
    expect(flow.continuationQuery).not.toContain("returnTo");
    expect(flow.continuationQuery).not.toContain("evil.example");
  });

  it("fails closed on a tampered redirect_uri while keeping product branding", () => {
    const flow = parseHostedAuthFlow(
      new URLSearchParams({
        ...shopAuthorize,
        redirect_uri: "https://evil.example/callback",
      }),
    );
    expect(flow.product).toBe("shop");
    expect(flow.authorizeResumePath).toBeNull();
    expect(flow.loginPath).toBe("/login?client_id=lax-shop-web");
  });

  it("rejects missing PKCE for confidential Shop clients", () => {
    const { code_challenge: _, code_challenge_method: __, ...withoutPkce } = shopAuthorize;
    const flow = parseHostedAuthFlow(new URLSearchParams(withoutPkce));
    expect(flow.authorizeResumePath).toBeNull();
  });

  it("rejects unknown client_id", () => {
    const flow = parseHostedAuthFlow(
      new URLSearchParams({ ...shopAuthorize, client_id: "not-registered" }),
    );
    expect(flow.clientId).toBeNull();
    expect(flow.product).toBe("unknown");
    expect(flow.authorizeResumePath).toBeNull();
  });

  it("keeps the full authorize query for cookie-backed resume only", () => {
    const flow = parseHostedAuthFlow(new URLSearchParams(shopAuthorize));
    expect(flow.loginPath).toBe("/login?client_id=lax-shop-web");
    expect(flow.authorizeResumePath).toContain("code_challenge=");
    expect(productHintHref("/forgot-password", flow)).toBe(
      "/forgot-password?client_id=lax-shop-web",
    );
    expect(productHintHref("/forgot-password", flow)).not.toContain("code_challenge");
    expect(productHintHref("/forgot-password", flow)).not.toContain("state=");
  });
});
