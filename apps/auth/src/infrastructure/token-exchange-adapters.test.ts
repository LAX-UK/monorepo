import { ACCESS_TOKEN_TTL_SECONDS } from "@auction/identity-contracts";
import { symmetricEncrypt } from "better-auth/crypto";
import { SignJWT, exportJWK, generateKeyPair, jwtVerify } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_TYPE,
  ID_TOKEN_TYPE,
  JWT_TOKEN_TYPE,
} from "../services/token-exchange.service.js";
import { createIdentityJwtSigner } from "./create-identity-jwt-signer.js";
import { createTokenExchangePorts } from "./token-exchange-adapters.js";

describe("Identity token exchange cryptography", () => {
  let publicJwk: string;
  let privateJwk: string;
  const authSecret = "development-secret-at-least-sixteen-characters";

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    publicJwk = JSON.stringify(await exportJWK(pair.publicKey));
    privateJwk = JSON.stringify(await exportJWK(pair.privateKey));
  });

  function ports(storedPrivateKey: string = privateJwk) {
    const jwks = {
      getJwks: async () => [
        { id: "active-key", publicKey: publicJwk, privateKey: storedPrivateKey, alg: "RS256" },
      ],
      getActiveSigningJwk: async () => ({
        id: "active-key",
        publicKey: publicJwk,
        privateKey: storedPrivateKey,
        alg: "RS256",
      }),
    };
    return createTokenExchangePorts({
      db: {} as never,
      issuer: "https://auth.lax.bid/",
      jwks,
      signer: createIdentityJwtSigner({ jwks, authSecret }),
    });
  }

  async function subjectToken(
    overrides: { issuer?: string; audience?: string; typ?: string } = {},
  ) {
    const key = await import("jose").then(({ importJWK }) =>
      importJWK(JSON.parse(privateJwk), "RS256"),
    );
    return new SignJWT({})
      .setProtectedHeader({
        alg: "RS256",
        kid: "active-key",
        ...(overrides.typ ? { typ: overrides.typ } : {}),
      })
      .setIssuer(overrides.issuer ?? "https://auth.lax.bid")
      .setAudience(overrides.audience ?? "lax-bid-web")
      .setSubject("subject-1")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);
  }

  it("requires valid issuer, signature, and exact client audience on the source token", async () => {
    await expect(
      ports().verifySubjectToken({
        token: await subjectToken(),
        tokenType: "urn:ietf:params:oauth:token-type:jwt",
        expectedAudience: "lax-bid-web",
      }),
    ).resolves.toEqual({ subject: "subject-1" });

    for (const token of [
      await subjectToken({ issuer: "https://evil.example" }),
      await subjectToken({ audience: "lax-shop-web" }),
    ]) {
      await expect(
        ports().verifySubjectToken({
          token,
          tokenType: "urn:ietf:params:oauth:token-type:jwt",
          expectedAudience: "lax-bid-web",
        }),
      ).resolves.toBeNull();
    }
  });

  it("binds the declared subject-token type to the JWT typ header", async () => {
    await expect(
      ports().verifySubjectToken({
        token: await subjectToken({ typ: "at+jwt" }),
        tokenType: ACCESS_TOKEN_TYPE,
        expectedAudience: "lax-bid-web",
      }),
    ).resolves.toEqual({ subject: "subject-1" });
    await expect(
      ports().verifySubjectToken({
        token: await subjectToken(),
        tokenType: ID_TOKEN_TYPE,
        expectedAudience: "lax-bid-web",
      }),
    ).resolves.toEqual({ subject: "subject-1" });

    for (const input of [
      { token: await subjectToken(), tokenType: ACCESS_TOKEN_TYPE },
      { token: await subjectToken({ typ: "logout+jwt" }), tokenType: JWT_TOKEN_TYPE },
      { token: await subjectToken({ typ: "secevent+jwt" }), tokenType: ID_TOKEN_TYPE },
    ]) {
      await expect(
        ports().verifySubjectToken({
          ...input,
          expectedAudience: "lax-bid-web",
        }),
      ).resolves.toBeNull();
    }
  });

  it("mints a 15-minute, single-resource JWT from the active key", async () => {
    const token = await ports().signAccessToken({
      subject: "subject-1",
      audience: "lax-bid-api",
      scopes: ["bid.read"],
    });
    const key = await import("jose").then(({ importJWK }) =>
      importJWK(JSON.parse(publicJwk), "RS256"),
    );
    const verified = await jwtVerify(token, key, {
      issuer: "https://auth.lax.bid",
      audience: "lax-bid-api",
    });
    expect(verified.payload.aud).toBe("lax-bid-api");
    expect(verified.payload.scope).toBe("bid.read");
    expect((verified.payload.exp ?? 0) - (verified.payload.iat ?? 0)).toBe(
      ACCESS_TOKEN_TTL_SECONDS,
    );
    expect(verified.protectedHeader).toMatchObject({ kid: "active-key", typ: "at+jwt" });
  });

  it("mints resource JWTs when Better Auth encrypts the stored private key", async () => {
    const encryptedPrivateKey = JSON.stringify(
      await symmetricEncrypt({ key: authSecret, data: privateJwk }),
    );
    const token = await ports(encryptedPrivateKey).signAccessToken({
      subject: "subject-1",
      audience: "lax-bid-api",
      scopes: ["bid.read"],
    });
    const key = await import("jose").then(({ importJWK }) =>
      importJWK(JSON.parse(publicJwk), "RS256"),
    );
    await expect(
      jwtVerify(token, key, {
        issuer: "https://auth.lax.bid",
        audience: "lax-bid-api",
      }),
    ).resolves.toBeDefined();
  });
});
