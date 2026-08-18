import { decodeJwt, decodeProtectedHeader, exportJWK, generateKeyPair, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import { BACKCHANNEL_LOGOUT_EVENT } from "../services/backchannel-logout.service.js";
import { createLogoutTokenSigner } from "./token-exchange-adapters.js";

describe("logout token signer", () => {
  it("produces the exact OIDC back-channel logout claim set without nonce", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
    const [privateJwk, publicJwk] = await Promise.all([
      exportJWK(privateKey),
      exportJWK(publicKey),
    ]);
    const signer = createLogoutTokenSigner({
      getJwks: async () => [],
      getActiveSigningJwk: async () => ({
        id: "key-1",
        privateKey: JSON.stringify(privateJwk),
        publicKey: JSON.stringify(publicJwk),
        alg: "RS256",
      }),
    });
    const token = await signer.signLogoutToken({
      iss: "https://auth.example.test",
      aud: "lax-shop-web",
      iat: 1_700_000_000,
      jti: "logout-jti",
      sid: "identity-session",
      events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
    });
    const claims = decodeJwt(token);
    expect(decodeProtectedHeader(token)).toEqual({
      alg: "RS256",
      kid: "key-1",
      typ: "logout+jwt",
    });
    expect(claims).toEqual({
      iss: "https://auth.example.test",
      aud: "lax-shop-web",
      iat: 1_700_000_000,
      jti: "logout-jti",
      sid: "identity-session",
      events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
    });
    expect(claims).not.toHaveProperty("nonce");
    await expect(
      jwtVerify(token, publicKey, {
        issuer: "https://auth.example.test",
        audience: "lax-shop-web",
        algorithms: ["RS256"],
      }),
    ).resolves.toBeDefined();
  });
});
