import { describe, expect, it } from "vitest";
import { parseHostedAuthFlow } from "./flow-context.js";
import { EMPTY_HOSTED_AUTH_CAPABILITIES, buildHostedAuthPageConfig } from "./view.js";

describe("buildHostedAuthPageConfig", () => {
  it("uses the art origin restart URL for lax-art-web", () => {
    const config = buildHostedAuthPageConfig(
      {
        clientId: "lax-art-web",
        product: "art",
        audience: "customer",
        continuationQuery: "",
        authorizeResumePath: null,
        loginPath: "/login?client_id=lax-art-web",
        allowedRedirectOrigins: ["http://localhost:3051"],
      },
      EMPTY_HOSTED_AUTH_CAPABILITIES,
    );
    expect(config.restartUrl).toBe("http://localhost:3050/login");
  });
});

describe("two-factor path", () => {
  it("carries the authorize request so the challenge can resume the product's sign-in", () => {
    const flow = parseHostedAuthFlow(
      new URLSearchParams(
        "response_type=code&client_id=lax-shop-web&redirect_uri=http://localhost:3010/auth/callback&scope=openid&state=abc&nonce=def&code_challenge=c&code_challenge_method=S256",
      ),
    );
    const config = buildHostedAuthPageConfig(flow, EMPTY_HOSTED_AUTH_CAPABILITIES);
    expect(config.twoFactorPath).toMatch(/^\/two-factor\?client_id=lax-shop-web&/);
    expect(config.twoFactorPath).toContain("state=abc");
  });
});
