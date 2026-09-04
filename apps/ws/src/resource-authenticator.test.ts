import { type Server, createServer } from "node:http";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyBidApiPrivilegeToken, verifyWsResourceToken } from "./resource-authenticator.js";

const issuer = "https://auth.lax.bid";
let server: Server;
let jwksUrl: string;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ keys: [{ ...jwk, kid: "rsa", alg: "RS256" }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing JWKS address");
  jwksUrl = `http://127.0.0.1:${address.port}/jwks`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function token(audience: string, scope = "bid.read") {
  return new SignJWT({ role: "buyer", scope, sid: "sid-1" })
    .setProtectedHeader({ alg: "RS256", kid: "rsa" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("user-1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

describe("WS resource-token conformance", () => {
  it("accepts only a WS-audience bid.read token at the socket boundary", async () => {
    await expect(
      verifyWsResourceToken({ token: await token("lax-ws"), issuer, jwksUrl }),
    ).resolves.toMatchObject({ subject: "user-1", sid: "sid-1" });
    await expect(
      verifyWsResourceToken({ token: await token("lax-bid-api"), issuer, jwksUrl }),
    ).resolves.toBeNull();
    await expect(
      verifyWsResourceToken({ token: await token("lax-ws", "bid.write"), issuer, jwksUrl }),
    ).resolves.toBeNull();
  });

  it("verifies the separate Bid API token used for fresh privilege checks", async () => {
    await expect(
      verifyBidApiPrivilegeToken({
        token: await token("lax-bid-api"),
        issuer,
        jwksUrl,
      }),
    ).resolves.toMatchObject({ subject: "user-1", sid: "sid-1" });
    await expect(
      verifyBidApiPrivilegeToken({ token: await token("lax-ws"), issuer, jwksUrl }),
    ).resolves.toBeNull();
  });
});
