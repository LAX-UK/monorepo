import { describe, expect, it } from "vitest";
import {
  hostedSignUpRequested,
  normalizeAuthorizePromptForCreate,
  parseHostedAuthFlow,
  productHintHref,
} from "./flow-context.js";

const artAuthorize = {
  response_type: "code",
  client_id: "lax-art-web",
  redirect_uri: "http://localhost:3051/auth/callback",
  scope: "openid profile email",
  state: "state-art",
  nonce: "nonce-art",
  code_challenge: "challenge",
  code_challenge_method: "S256",
};

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
  it("resumes a validated lax.art authorization request", () => {
    const flow = parseHostedAuthFlow(new URLSearchParams(artAuthorize));
    expect(flow.product).toBe("art");
    expect(flow.clientId).toBe("lax-art-web");
    expect(flow.allowedRedirectOrigins).toContain("http://localhost:3051");
  });

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

  it("keeps a plausible login hint for prefilling, and drops anything else", () => {
    const flow = parseHostedAuthFlow(
      new URLSearchParams({ ...shopAuthorize, login_hint: "ada@example.com" }),
    );
    expect(flow.loginHint).toBe("ada@example.com");
    const resume = new URL(flow.authorizeResumePath ?? "", "http://issuer.test");
    expect(resume.searchParams.get("login_hint")).toBe("ada@example.com");
    expect(
      parseHostedAuthFlow(new URLSearchParams({ ...shopAuthorize, login_hint: "<script>" }))
        .loginHint,
    ).toBeNull();
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

  it("detects prompt=create and hosted_chrome sign-up hints", () => {
    const withCreate = new URLSearchParams({ ...shopAuthorize, prompt: "create" });
    expect(hostedSignUpRequested(withCreate)).toBe(true);
    const withHostedChrome = new URLSearchParams({
      client_id: "lax-shop-web",
      hosted_chrome: "sign-up",
    });
    expect(hostedSignUpRequested(withHostedChrome)).toBe(true);
    expect(hostedSignUpRequested(new URLSearchParams(shopAuthorize))).toBe(false);
  });

  it("strips create from authorize URLs for Better Auth compatibility", () => {
    const url = new URL("https://issuer.test/api/auth/oauth2/authorize");
    url.search = new URLSearchParams({ ...shopAuthorize, prompt: "create login" }).toString();
    const normalized = normalizeAuthorizePromptForCreate(url);
    expect(normalized?.searchParams.get("prompt")).toBe("login");
    expect(normalized?.searchParams.get("hosted_chrome")).toBe("sign-up");
  });

  it("keeps acr_values in the authorize resume query", () => {
    const flow = parseHostedAuthFlow(
      new URLSearchParams({
        ...shopAuthorize,
        acr_values: "urn:mace:incommon:iap:silver",
      }),
    );
    expect(flow.authorizeResumePath).toContain("acr_values=");
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

describe("parseHostedAuthFlow re-check kept by the OIDC provider", () => {
  const accountAuthorize = {
    response_type: "code",
    client_id: "lax-account-web",
    redirect_uri: "http://localhost:3040/api/auth/callback",
    scope: "openid profile email",
    state: "state-account",
    nonce: "nonce-account",
    code_challenge: "challenge",
    code_challenge_method: "S256",
    prompt: "login",
    max_age: "300",
    reauth_reason: "sign_out_devices",
  };
  // Where the provider sends a browser that already holds a session.
  const loginPageRedirect = new URLSearchParams({
    client_id: "lax-account-web",
    code: "provider-code",
    state: "state-account",
  });

  it("reads Account's re-check and reason from the provider's kept request", () => {
    const flow = parseHostedAuthFlow(loginPageRedirect, new URLSearchParams(accountAuthorize));
    expect(flow.reauth).toBe(true);
    expect(flow.reauthReason).toBe("sign_out_devices");
  });

  it("is not a re-check from the redirect alone", () => {
    const flow = parseHostedAuthFlow(loginPageRedirect);
    expect(flow.reauth).toBe(false);
    expect(flow.reauthReason).toBeNull();
  });

  it("ignores a kept request for another authorization", () => {
    const otherState = new URLSearchParams({ ...accountAuthorize, state: "another-state" });
    expect(parseHostedAuthFlow(loginPageRedirect, otherState).reauth).toBe(false);
    const noState = new URLSearchParams({ client_id: "lax-account-web", code: "provider-code" });
    expect(parseHostedAuthFlow(noState, new URLSearchParams(accountAuthorize)).reauth).toBe(false);
  });

  it("ignores a kept request for another product, or one that never asked for a sign-in", () => {
    const shopRedirect = new URLSearchParams({ ...Object.fromEntries(loginPageRedirect) });
    shopRedirect.set("client_id", "lax-shop-web");
    const shopKept = new URLSearchParams({
      ...shopAuthorize,
      state: "state-account",
      prompt: "login",
    });
    expect(parseHostedAuthFlow(shopRedirect, shopKept).reauth).toBe(false);
    const { prompt: _prompt, ...withoutPrompt } = accountAuthorize;
    expect(parseHostedAuthFlow(loginPageRedirect, new URLSearchParams(withoutPrompt)).reauth).toBe(
      false,
    );
  });

  it("ignores a kept request whose callback is not registered for Account", () => {
    const tampered = new URLSearchParams({
      ...accountAuthorize,
      redirect_uri: "https://evil.example/api/auth/callback",
    });
    expect(parseHostedAuthFlow(loginPageRedirect, tampered).reauth).toBe(false);
  });

  it("keeps the reason from the URL when the URL itself is the re-check", () => {
    const url = new URLSearchParams(accountAuthorize);
    const kept = new URLSearchParams({ ...accountAuthorize, reauth_reason: "change_password" });
    expect(parseHostedAuthFlow(url, kept).reauthReason).toBe("sign_out_devices");
  });
});
