import { ACCESS_TOKEN_TTL_SECONDS } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import {
  ACCESS_TOKEN_TYPE,
  TokenExchangeError,
  TokenExchangeService,
  resolveTokenExchangePolicy,
} from "./token-exchange.service.js";

describe("token exchange policy", () => {
  it("rejects an empty requested scope", () => {
    expect(() =>
      resolveTokenExchangePolicy({
        clientId: "lax-shop-web",
        resource: "https://shop.lax.art/api",
        scope: "",
      }),
    ).toThrowError(
      new TokenExchangeError("invalid_scope", "At least one product scope is required"),
    );
  });

  it("maps canonical resource indicators to one audience", () => {
    expect(
      resolveTokenExchangePolicy({
        clientId: "lax-shop-web",
        resource: "https://shop.lax.art/api",
        scope: "shop.read shop.write",
      }),
    ).toEqual({
      audience: "lax-shop-api",
      scopes: ["shop.read", "shop.write"],
    });
  });

  it("isolates resources and scope namespaces per client", () => {
    expect(() =>
      resolveTokenExchangePolicy({
        clientId: "lax-bid-web",
        resource: "https://shop.lax.art/api",
        scope: "shop.read",
      }),
    ).toThrowError(
      new TokenExchangeError("invalid_target", "The requested resource is not allowed"),
    );
    expect(() =>
      resolveTokenExchangePolicy({
        clientId: "lax-bid-web",
        resource: "https://api.lax.bid",
        scope: "bid.read shop.read",
      }),
    ).toThrowError(new TokenExchangeError("invalid_scope", "The requested scope is not allowed"));
  });

  it("lets LAX Admin ask Bid for the staff tools with the narrow scope only", () => {
    expect(
      resolveTokenExchangePolicy({
        clientId: "lax-shop-admin",
        resource: "https://api.lax.bid",
        scope: "lax.staff.tools.read",
      }),
    ).toEqual({ audience: "lax-bid-api", scopes: ["lax.staff.tools.read"] });
    for (const scope of ["bid.read", "bid.write", "lax.portfolio.read"]) {
      expect(() =>
        resolveTokenExchangePolicy({
          clientId: "lax-shop-admin",
          resource: "https://api.lax.bid",
          scope,
        }),
      ).toThrowError(new TokenExchangeError("invalid_scope", "The requested scope is not allowed"));
    }
    expect(() =>
      resolveTokenExchangePolicy({
        clientId: "lax-account-web",
        resource: "https://api.lax.bid",
        scope: "lax.staff.tools.read",
      }),
    ).toThrowError(new TokenExchangeError("invalid_scope", "The requested scope is not allowed"));
  });

  it("lets LAX Account act on the person's own Shop seller tools with the selling scopes", () => {
    for (const scope of ["lax.selling.read", "lax.selling.read lax.selling.write"]) {
      expect(
        resolveTokenExchangePolicy({
          clientId: "lax-account-web",
          resource: "https://shop.lax.art/api",
          scope,
        }),
      ).toEqual({ audience: "lax-shop-api", scopes: scope.split(" ") });
      expect(() =>
        resolveTokenExchangePolicy({
          clientId: "lax-account-web",
          resource: "https://api.lax.bid",
          scope,
        }),
      ).toThrowError(new TokenExchangeError("invalid_scope", "The requested scope is not allowed"));
    }
    for (const clientId of ["lax-shop-web", "lax-shop-admin"] as const) {
      expect(() =>
        resolveTokenExchangePolicy({
          clientId,
          resource: "https://shop.lax.art/api",
          scope: "lax.selling.read",
        }),
      ).toThrowError(new TokenExchangeError("invalid_scope", "The requested scope is not allowed"));
    }
  });

  it("lets LAX Account read portfolios from Bid and Shop with the narrow scope only", () => {
    for (const [resource, audience] of [
      ["https://api.lax.bid", "lax-bid-api"],
      ["https://shop.lax.art/api", "lax-shop-api"],
    ] as const) {
      expect(
        resolveTokenExchangePolicy({
          clientId: "lax-account-web",
          resource,
          scope: "lax.portfolio.read",
        }),
      ).toEqual({ audience, scopes: ["lax.portfolio.read"] });
    }
    expect(() =>
      resolveTokenExchangePolicy({
        clientId: "lax-account-web",
        resource: "https://api.lax.bid",
        scope: "bid.read",
      }),
    ).toThrowError(new TokenExchangeError("invalid_scope", "The requested scope is not allowed"));
    expect(() =>
      resolveTokenExchangePolicy({
        clientId: "lax-account-web",
        resource: "https://ws.lax.bid",
        scope: "bid.read",
      }),
    ).toThrowError(
      new TokenExchangeError("invalid_target", "The requested resource is not allowed"),
    );
  });
});

describe("TokenExchangeService", () => {
  it("validates the client-bound source token and active subject before minting", async () => {
    const verifySubjectToken = vi.fn().mockResolvedValue({ subject: "subject-1" });
    const isSubjectActive = vi.fn().mockResolvedValue(true);
    const signAccessToken = vi.fn().mockResolvedValue("resource.jwt");
    const service = new TokenExchangeService({
      verifySubjectToken,
      isSubjectActive,
      signAccessToken,
    });

    await expect(
      service.exchange({
        clientId: "lax-bid-web",
        subjectToken: "identity.jwt",
        subjectTokenType: ACCESS_TOKEN_TYPE,
        resource: "https://api.lax.bid",
        scope: "bid.read",
      }),
    ).resolves.toEqual({
      access_token: "resource.jwt",
      issued_token_type: ACCESS_TOKEN_TYPE,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: "bid.read",
    });
    expect(verifySubjectToken).toHaveBeenCalledWith({
      token: "identity.jwt",
      tokenType: ACCESS_TOKEN_TYPE,
      expectedAudience: "lax-bid-web",
    });
    expect(signAccessToken).toHaveBeenCalledWith({
      subject: "subject-1",
      audience: "lax-bid-api",
      scopes: ["bid.read"],
    });
  });

  it("rejects disabled, missing, or merged subjects as invalid subject tokens", async () => {
    const service = new TokenExchangeService({
      verifySubjectToken: vi.fn().mockResolvedValue({ subject: "retired" }),
      isSubjectActive: vi.fn().mockResolvedValue(false),
      signAccessToken: vi.fn(),
    });
    await expect(
      service.exchange({
        clientId: "lax-shop-web",
        subjectToken: "identity.jwt",
        subjectTokenType: ACCESS_TOKEN_TYPE,
        resource: "https://shop.lax.art/api",
        scope: "shop.read",
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });
});
