import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { RpInitiatedLogoutVerifier } from "./rp-initiated-logout-verifier.js";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const jwks = {
    getJwks: async () => [
      {
        id: "logout-key",
        publicKey: JSON.stringify(publicJwk),
        alg: "RS256",
      },
    ],
  };
  const sign = (claims?: {
    issuer?: string;
    audience?: string | string[];
    subject?: string;
    sessionId?: string;
    issuedAt?: number;
    expiresIn?: string;
  }) =>
    new SignJWT({ sid: claims?.sessionId ?? "session-1" })
      .setProtectedHeader({ alg: "RS256", kid: "logout-key" })
      .setIssuer(claims?.issuer ?? "https://auth.example.test")
      .setAudience(claims?.audience ?? "lax-shop-web")
      .setSubject(claims?.subject ?? "subject-1")
      .setIssuedAt(claims?.issuedAt ?? Math.floor(Date.now() / 1_000))
      .setExpirationTime(claims?.expiresIn ?? "5m")
      .sign(privateKey);
  return { jwks, sign, privateKey };
}

describe("RpInitiatedLogoutVerifier", () => {
  it("accepts a signed ID token for the registered client audience", async () => {
    const { jwks, sign } = await fixture();
    const verifier = new RpInitiatedLogoutVerifier("https://auth.example.test/", jwks);

    await expect(
      verifier.verify({
        idTokenHint: await sign(),
        clientId: "lax-shop-web",
      }),
    ).resolves.toEqual({
      subjectId: "subject-1",
      sessionId: "session-1",
      clientId: "lax-shop-web",
      expired: false,
    });
  });

  it("infers the client from a single registered audience", async () => {
    const { jwks, sign } = await fixture();
    const verifier = new RpInitiatedLogoutVerifier("https://auth.example.test", jwks);

    await expect(
      verifier.verify({
        idTokenHint: await sign({ audience: "lax-bid-web" }),
      }),
    ).resolves.toEqual({
      subjectId: "subject-1",
      sessionId: "session-1",
      clientId: "lax-bid-web",
      expired: false,
    });
  });

  it("accepts an expired but authentic hint within the bounded age window", async () => {
    const { jwks, sign } = await fixture();
    const now = new Date("2026-09-08T12:00:00.000Z");
    const verifier = new RpInitiatedLogoutVerifier("https://auth.example.test", jwks, () => now);

    await expect(
      verifier.verify({
        idTokenHint: await sign({
          issuedAt: Math.floor(now.getTime() / 1_000) - 300,
          expiresIn: "-1m",
        }),
        clientId: "lax-shop-web",
      }),
    ).resolves.toEqual({
      subjectId: "subject-1",
      sessionId: "session-1",
      clientId: "lax-shop-web",
      expired: true,
    });
  });

  it("rejects issuer, audience, subject, sid, age, and signature mismatches", async () => {
    const { jwks, sign } = await fixture();
    const now = new Date("2026-09-08T12:00:00.000Z");
    const verifier = new RpInitiatedLogoutVerifier("https://auth.example.test", jwks, () => now);
    const other = await fixture();

    for (const idTokenHint of [
      await sign({ issuer: "https://other.example.test" }),
      await sign({ audience: "lax-bid-web" }),
      await sign({ subject: "" }),
      await sign({ sessionId: "" }),
      await sign({ audience: ["lax-shop-web", "lax-bid-web"] }),
      await sign({ issuedAt: Math.floor(now.getTime() / 1_000) - 86_401 }),
      await other.sign(),
    ]) {
      await expect(
        verifier.verify({
          idTokenHint,
          clientId: "lax-shop-web",
        }),
      ).resolves.toBeNull();
    }
  });
});
