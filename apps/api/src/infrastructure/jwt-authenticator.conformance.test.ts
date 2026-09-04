import { type Server, createServer } from "node:http";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { JwtAuthenticator } from "./jwt-authenticator.js";

const issuer = "https://auth.lax.bid";
let server: Server;
let jwksUrl: string;
let rsaPrivateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let ecPrivateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

beforeAll(async () => {
  const rsa = await generateKeyPair("RS256");
  const ec = await generateKeyPair("ES256");
  rsaPrivateKey = rsa.privateKey;
  ecPrivateKey = ec.privateKey;
  const rsaJwk = await exportJWK(rsa.publicKey);
  const ecJwk = await exportJWK(ec.publicKey);
  server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        keys: [
          { ...rsaJwk, kid: "rsa", alg: "RS256" },
          { ...ecJwk, kid: "ec", alg: "ES256" },
        ],
      }),
    );
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

async function token(audience: string, algorithm: "RS256" | "ES256" = "RS256") {
  return new SignJWT({ role: "buyer", scope: "bid.read" })
    .setProtectedHeader({
      alg: algorithm,
      kid: algorithm === "RS256" ? "rsa" : "ec",
    })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("user-1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(algorithm === "RS256" ? rsaPrivateKey : ecPrivateKey);
}

function authenticate(
  audience = "lax-bid-api",
  options: Partial<ConstructorParameters<typeof JwtAuthenticator>[0]> = {},
) {
  return new JwtAuthenticator({ issuer, jwksUrl, audience, ...options });
}

describe("API resource-token conformance", () => {
  it("accepts only a valid RS256 lax-bid-api audience", async () => {
    await expect(
      authenticate().getSessionUser(
        new Headers({ authorization: `Bearer ${await token("lax-bid-api")}` }),
      ),
    ).resolves.toMatchObject({ id: "user-1", scopes: ["bid.read"] });
    await expect(
      authenticate().getSessionUser(
        new Headers({ authorization: `Bearer ${await token("lax-ws")}` }),
      ),
    ).resolves.toBeNull();
    await expect(
      authenticate().getSessionUser(
        new Headers({ authorization: `Bearer ${await token("lax-bid-api", "ES256")}` }),
      ),
    ).resolves.toBeNull();
  });

  it("rejects lax-api by default and accepts it only with flag plus telemetry", async () => {
    const legacy = await token("lax-api");
    await expect(
      authenticate().getSessionUser(new Headers({ authorization: `Bearer ${legacy}` })),
    ).resolves.toBeNull();
    const telemetry = vi.fn();
    await expect(
      authenticate("lax-bid-api", {
        allowLegacyLaxApiAudience: true,
        onLegacyAudienceAccepted: telemetry,
      }).getSessionUser(new Headers({ authorization: `Bearer ${legacy}` })),
    ).resolves.toMatchObject({ id: "user-1" });
    expect(telemetry).toHaveBeenCalledOnce();
  });
});
