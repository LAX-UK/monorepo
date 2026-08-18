import { ACCESS_TOKEN_TTL_SECONDS } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import {
  ACCESS_TOKEN_TYPE,
  TokenExchangeError,
  TokenExchangeService,
  resolveTokenExchangePolicy,
} from "./token-exchange.service.js";

describe("token exchange policy", () => {
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
