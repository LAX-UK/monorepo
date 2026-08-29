import { symmetricDecrypt } from "better-auth/crypto";
import { importJWK } from "jose";

function isJsonWebKey(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && "kty" in value;
}

/**
 * Better Auth stores adapter private keys encrypted with BETTER_AUTH_SECRET.
 * Plain JWK JSON (tests and disablePrivateKeyEncryption) is also supported.
 */
export async function importIdentitySigningKey(input: {
  storedPrivateKey: string;
  alg: string;
  authSecret: string;
}): Promise<Awaited<ReturnType<typeof importJWK>>> {
  const parsed: unknown = JSON.parse(input.storedPrivateKey);
  if (isJsonWebKey(parsed)) {
    return importJWK(parsed, input.alg);
  }
  const encrypted = typeof parsed === "string" ? parsed : input.storedPrivateKey;
  const decrypted = await symmetricDecrypt({ key: input.authSecret, data: encrypted });
  return importJWK(JSON.parse(decrypted) as Record<string, unknown>, input.alg);
}
