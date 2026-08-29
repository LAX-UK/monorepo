import { symmetricEncrypt } from "better-auth/crypto";
import { decodeProtectedHeader, exportJWK, generateKeyPair, jwtVerify } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { createIdentityJwtSigner } from "./create-identity-jwt-signer.js";
import { JoseSsfSigner } from "./jose-ssf.signer.js";

describe("IdentityJwtSigner", () => {
  let publicJwk: string;
  let privateJwk: string;
  const authSecret = "development-secret-at-least-sixteen-characters";

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    publicJwk = JSON.stringify(await exportJWK(pair.publicKey));
    privateJwk = JSON.stringify(await exportJWK(pair.privateKey));
  });

  function signer(storedPrivateKey: string = privateJwk) {
    const jwks = {
      getJwks: async () => [],
      getActiveSigningJwk: async () => ({
        id: "active-key",
        publicKey: publicJwk,
        privateKey: storedPrivateKey,
        alg: "RS256",
      }),
    };
    return createIdentityJwtSigner({ jwks, authSecret });
  }

  it("signs RS256 JWTs with Better Auth encrypted private key material", async () => {
    const encryptedPrivateKey = JSON.stringify(
      await symmetricEncrypt({ key: authSecret, data: privateJwk }),
    );
    const { token, kid } = await signer(encryptedPrivateKey).sign({
      typ: "secevent+jwt",
      issuer: "https://auth.lax.bid",
      audience: "lax-bid-api",
      jwtId: "set-jti",
      issuedAt: 1_700_000_000,
      claims: {
        sub_id: { format: "opaque", id: "subject-1" },
        events: { "https://schemas.openid.net/secevent/risc/event-type/account-disabled": {} },
      },
    });
    expect(kid).toBe("active-key");
    expect(decodeProtectedHeader(token)).toMatchObject({
      alg: "RS256",
      kid: "active-key",
      typ: "secevent+jwt",
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

describe("JoseSsfSigner", () => {
  it("delegates SSF SET signing to IdentityJwtSigner", async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    const [privateJwk, publicJwk] = await Promise.all([
      exportJWK(pair.privateKey),
      exportJWK(pair.publicKey),
    ]);
    const jwks = {
      getJwks: async () => [],
      getActiveSigningJwk: async () => ({
        id: "ssf-key",
        privateKey: JSON.stringify(privateJwk),
        publicKey: JSON.stringify(publicJwk),
        alg: "RS256",
      }),
    };
    const ssfSigner = new JoseSsfSigner(
      createIdentityJwtSigner({
        jwks,
        authSecret: "development-secret-at-least-sixteen-characters",
      }),
    );
    const { token, signingKid } = await ssfSigner.sign({
      issuer: "https://auth.lax.bid",
      audience: "lax-bid-api",
      subjectId: "subject-1",
      eventType: "https://schemas.openid.net/secevent/risc/event-type/account-disabled",
      event: {
        subject: { subject_type: "iss-sub", iss: "https://auth.lax.bid", sub: "subject-1" },
      },
      jti: "delivery-jti",
      issuedAt: 1_700_000_000,
    });
    expect(signingKid).toBe("ssf-key");
    expect(decodeProtectedHeader(token).typ).toBe("secevent+jwt");
    await expect(
      jwtVerify(token, pair.publicKey, {
        issuer: "https://auth.lax.bid",
        audience: "lax-bid-api",
      }),
    ).resolves.toBeDefined();
  });
});
