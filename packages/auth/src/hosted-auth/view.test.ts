import { describe, expect, it } from "vitest";
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
