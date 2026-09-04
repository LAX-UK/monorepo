import { SignJWT } from "jose";
import type { IdentityJwtSigner } from "./identity-jwt-signer.ports.js";
import type { JwksProvider } from "./jwks-provider.js";
import { importIdentitySigningKey } from "./resolve-stored-signing-jwk.js";

export function createIdentityJwtSigner(options: {
  jwks: JwksProvider;
  authSecret: string;
}): IdentityJwtSigner {
  return {
    async sign(input) {
      const active = await options.jwks.getActiveSigningJwk();
      if (!active) throw new Error("No active Identity signing key");
      const alg = input.algorithm ?? active.alg ?? "RS256";
      if (alg !== "RS256") {
        throw new Error("active_rs256_signing_key_required");
      }
      const key = await importIdentitySigningKey({
        storedPrivateKey: active.privateKey,
        alg,
        authSecret: options.authSecret,
      });
      let token = new SignJWT(input.claims)
        .setProtectedHeader({ alg, kid: active.id, typ: input.typ })
        .setIssuer(input.issuer)
        .setAudience(input.audience);
      if (input.subject) token = token.setSubject(input.subject);
      if (input.issuedAt !== undefined) token = token.setIssuedAt(input.issuedAt);
      else token = token.setIssuedAt();
      if (input.expirationTime) token = token.setExpirationTime(input.expirationTime);
      if (input.jwtId) token = token.setJti(input.jwtId);
      return { token: await token.sign(key), kid: active.id };
    },
  };
}
