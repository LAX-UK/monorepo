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
  const sign = (claims?: { issuer?: string; audience?: string; subject?: string }) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "logout-key" })
      .setIssuer(claims?.issuer ?? "https://auth.example.test")
      .setAudience(claims?.audience ?? "lax-shop-web")
      .setSubject(claims?.subject ?? "subject-1")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  return { jwks, sign };
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
    ).resolves.toEqual({ subjectId: "subject-1" });
  });

  it("rejects issuer, audience, subject, and signature mismatches", async () => {
    const { jwks, sign } = await fixture();
    const verifier = new RpInitiatedLogoutVerifier("https://auth.example.test", jwks);
    const other = await fixture();

    for (const idTokenHint of [
      await sign({ issuer: "https://other.example.test" }),
      await sign({ audience: "lax-bid-web" }),
      await sign({ subject: "" }),
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
